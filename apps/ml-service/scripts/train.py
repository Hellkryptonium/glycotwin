import json
import os
from pathlib import Path
import sys
import warnings

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parents[1] / "artifacts" / ".matplotlib"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score, ConfusionMatrixDisplay,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from app.core.config import (
    ARTIFACT_DIR, CONFUSION_MATRIX_PATH, DATA_PATH, FEATURES,
    FEATURE_IMPORTANCE_PATH, METRICS_PATH, MODEL_PATH, TARGET, ZERO_AS_MISSING,
)
from app.models.pipeline import build_models
from app.services.data import load_dataset

RANDOM_STATE = 42


def main() -> None:
    warnings.filterwarnings("ignore", category=FutureWarning)
    frame = load_dataset(DATA_PATH)
    X, y = frame[FEATURES], frame[TARGET].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_STATE, stratify=y
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scores = {}
    models = build_models(RANDOM_STATE)
    for name, model in models.items():
        fold_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=1)
        scores[name] = {"fold_roc_auc": fold_scores.tolist(), "mean_roc_auc": float(fold_scores.mean()),
                        "std_roc_auc": float(fold_scores.std())}
        print(f"{name}: training CV ROC-AUC {fold_scores.mean():.3f} +/- {fold_scores.std():.3f}")

    # Choose by training-only mean ROC-AUC; the test set has not influenced selection.
    selected_name = max(scores, key=lambda name: scores[name]["mean_roc_auc"])
    selected = models[selected_name].fit(X_train, y_train)
    probabilities = selected.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])
    metrics = {
        "dataset": "Pima Indians Diabetes Database",
        "dataset_rows": len(frame),
        "class_distribution": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
        "zero_sentinels_replaced_per_feature": {
            name: int((frame[name] == 0).sum()) for name in ZERO_AS_MISSING
        },
        "random_state": RANDOM_STATE,
        "test_size": 0.2,
        "training_cv": scores,
        "selection_metric": "mean 5-fold training ROC-AUC",
        "selected_model": selected_name,
        "decision_threshold": 0.5,
        "test_metrics": {
            "accuracy": float(accuracy_score(y_test, predictions)),
            "precision": float(precision_score(y_test, predictions, zero_division=0)),
            "recall": float(recall_score(y_test, predictions, zero_division=0)),
            "f1": float(f1_score(y_test, predictions, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, probabilities)),
            "confusion_matrix_labels_0_1": matrix.tolist(),
            "classification_report": classification_report(
                y_test, predictions, labels=[0, 1], output_dict=True, zero_division=0
            ),
        },
        "limitations": [
            "Small historical dataset; not representative of all populations.",
            "Not a clinically validated diagnostic system or calibrated personal risk estimator.",
            "At the fixed 0.5 threshold, precision and recall reflect a trade-off; neither is a clinical operating point.",
        ],
    }
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    import joblib
    joblib.dump({"pipeline": selected, "model_name": selected_name, "version": "1.0.0"}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    disp = ConfusionMatrixDisplay(matrix, display_labels=["No outcome", "Outcome"])
    disp.plot(cmap="Blues", values_format="d")
    plt.title("Model A test confusion matrix")
    plt.tight_layout()
    plt.savefig(CONFUSION_MATRIX_PATH, dpi=160)
    plt.close()

    classifier = selected.named_steps["classifier"]
    if selected_name == "xgboost":
        importances = classifier.feature_importances_
    else:
        importances = np.abs(classifier.coef_[0])
    order = np.argsort(importances)
    plt.figure(figsize=(8, 5))
    plt.barh(np.array(FEATURES)[order], np.array(importances)[order], color="#4776a8")
    plt.xlabel("Gain-based importance" if selected_name == "xgboost" else "Absolute standardized coefficient")
    plt.title(f"Feature importance ({selected_name}) — association, not causation")
    plt.tight_layout()
    plt.savefig(FEATURE_IMPORTANCE_PATH, dpi=160)
    plt.close()
    print(json.dumps(metrics["test_metrics"], indent=2))
    print(f"Saved model and evaluation artifacts under {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
