"""Train modest NHANES model comparisons with train-only cross-validation."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
import joblib

from common import ARTIFACT_DIR, FEATURE_SETS, SEED, TARGETS, TEST_SIZE, make_preprocessor, read_cohort


MODELS = {
    "logistic_regression": lambda: LogisticRegression(max_iter=2000, class_weight="balanced", random_state=SEED),
    "random_forest": lambda: RandomForestClassifier(
        n_estimators=300, min_samples_leaf=3, max_features="sqrt", class_weight="balanced_subsample",
        random_state=SEED, n_jobs=2,
    ),
    "xgboost": lambda: XGBClassifier(
        n_estimators=120, max_depth=3, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9,
        reg_lambda=1.0, eval_metric="logloss", random_state=SEED, n_jobs=2, verbosity=0,
    ),
}


def make_pipeline(model_name: str, features: list[str]) -> Pipeline:
    scale = model_name == "logistic_regression"
    return Pipeline([
        ("preprocessor", make_preprocessor(features, scale_numeric=scale)),
        ("classifier", MODELS[model_name]()),
    ])


def main() -> None:
    (ARTIFACT_DIR / "models").mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "cycle": "NHANES 2017-2018", "seed": SEED, "test_size": TEST_SIZE,
        "selection_metric": "mean 5-fold training-only ROC-AUC", "threshold": 0.5,
        "models": {},
    }
    model_records: dict[str, object] = {}
    for cohort_name, target in TARGETS.items():
        frame = read_cohort(cohort_name).reset_index(drop=True)
        frame = frame[frame[target].notna()].reset_index(drop=True)
        y = frame[target].astype(int)
        indices = np.arange(len(frame))
        train_idx, test_idx = train_test_split(
            indices, test_size=TEST_SIZE, random_state=SEED, stratify=y,
        )
        cohort_manifest: dict[str, object] = {
            "target": target, "n": len(frame), "class_counts": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
            "train_indices": train_idx.tolist(), "test_indices": test_idx.tolist(),
            "feature_sets": {},
        }
        for feature_set, features in FEATURE_SETS.items():
            X_train = frame.iloc[train_idx][features]
            y_train = y.iloc[train_idx]
            minimum_class = int(y_train.value_counts().min())
            folds = min(5, minimum_class)
            if folds < 2:
                raise ValueError(f"Too few examples per class for CV: {cohort_name}/{feature_set}")
            cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
            feature_result: dict[str, object] = {"features": features, "models": {}}
            for model_name in MODELS:
                pipeline = make_pipeline(model_name, features)
                scores = cross_validate(
                    pipeline, X_train, y_train, cv=cv,
                    scoring={"roc_auc": "roc_auc", "average_precision": "average_precision"},
                    n_jobs=1, return_train_score=False, error_score="raise",
                )
                pipeline.fit(X_train, y_train)
                model_path = ARTIFACT_DIR / "models" / f"{cohort_name}__{feature_set}__{model_name}.joblib"
                joblib.dump(pipeline, model_path)
                cv_result = {
                    "cv_folds": int(folds),
                    "cv_roc_auc": [float(v) for v in scores["test_roc_auc"]],
                    "cv_roc_auc_mean": float(np.mean(scores["test_roc_auc"])),
                    "cv_roc_auc_std": float(np.std(scores["test_roc_auc"], ddof=1)) if folds > 1 else 0.0,
                    "cv_average_precision_mean": float(np.mean(scores["test_average_precision"])),
                    "model_path": str(model_path.relative_to(ARTIFACT_DIR)),
                }
                feature_result["models"][model_name] = cv_result
                model_records[f"{cohort_name}__{feature_set}__{model_name}"] = cv_result
            best = max(feature_result["models"], key=lambda name: feature_result["models"][name]["cv_roc_auc_mean"])
            feature_result["cv_selected_model"] = best
            cohort_manifest["feature_sets"][feature_set] = feature_result
        manifest["models"][cohort_name] = cohort_manifest
    manifest["flat_model_results"] = model_records
    (ARTIFACT_DIR / "training_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Training complete. Manifest: {ARTIFACT_DIR / 'training_manifest.json'}")


if __name__ == "__main__":
    main()
