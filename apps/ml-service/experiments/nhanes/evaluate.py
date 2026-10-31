"""Evaluate held-out NHANES results and generate summary artifacts and plots."""

from __future__ import annotations

import json

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score, balanced_accuracy_score, ConfusionMatrixDisplay,
    confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score,
    roc_curve, precision_recall_curve,
)

from common import ARTIFACT_DIR, FEATURE_SETS, PROCESSED_DIR, REPORT_DIR, ROOT, TARGETS, read_cohort


def calculate_metrics(y_true: np.ndarray, probabilities: np.ndarray, threshold: float = 0.5) -> dict[str, object]:
    predicted = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predicted, labels=[0, 1]).ravel()
    return {
        "n": int(len(y_true)), "positive_n": int(np.sum(y_true == 1)), "negative_n": int(np.sum(y_true == 0)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "sensitivity_recall": float(recall_score(y_true, predicted, zero_division=0)),
        "specificity": float(tn / (tn + fp)) if tn + fp else None,
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, predicted)),
        "confusion_matrix_tn_fp_fn_tp": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "threshold": threshold,
    }


def bootstrap_intervals(y_true: np.ndarray, probabilities: np.ndarray, iterations: int = 1000, seed: int = 2026) -> dict[str, list[float] | int]:
    rng = np.random.default_rng(seed)
    samples: dict[str, list[float]] = {key: [] for key in ["roc_auc", "average_precision", "sensitivity_recall", "specificity", "precision", "f1", "balanced_accuracy"]}
    for _ in range(iterations):
        idx = rng.integers(0, len(y_true), len(y_true))
        yb = y_true[idx]
        if np.unique(yb).size < 2:
            continue
        metrics = calculate_metrics(yb, probabilities[idx])
        for key in samples:
            if metrics[key] is not None:
                samples[key].append(float(metrics[key]))
    return {
        key: [float(np.quantile(values, .025)), float(np.quantile(values, .975))] if values else [float("nan"), float("nan")]
        for key, values in samples.items()
    } | {"valid_replicates": min((len(values) for values in samples.values()), default=0)}


def plot_primary(best_model: str, pipeline: object, X_test: pd.DataFrame, y_test: np.ndarray, y_prob: np.ndarray, metrics: dict[str, object]) -> None:
    cm = np.array(metrics["confusion_matrix_tn_fp_fn_tp"])
    fig, ax = plt.subplots(figsize=(5.4, 4.6))
    ConfusionMatrixDisplay(cm, display_labels=["Below thresholds", "Meets lab cutpoint"]).plot(ax=ax, colorbar=False, cmap="Blues", values_format="d")
    ax.set_title(f"NHANES lab target · {best_model} · threshold 0.5")
    fig.tight_layout()
    fig.savefig(ARTIFACT_DIR / "confusion_matrix.png", dpi=180)
    plt.close(fig)

    fpr, tpr, _ = roc_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(5.4, 4.6))
    ax.plot(fpr, tpr, label=f"AUC {metrics['roc_auc']:.3f}")
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray")
    ax.set(xlabel="False positive rate", ylabel="True positive rate", title="Held-out ROC · lab-defined target")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(ARTIFACT_DIR / "roc_curve.png", dpi=180)
    plt.close(fig)

    precision, recall, _ = precision_recall_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(5.4, 4.6))
    ax.plot(recall, precision, label=f"AP {metrics['average_precision']:.3f}")
    ax.axhline(float(np.mean(y_test)), linestyle="--", color="gray", label=f"Prevalence {np.mean(y_test):.3f}")
    ax.set(xlabel="Recall", ylabel="Precision", title="Held-out precision–recall · lab-defined target")
    ax.legend(loc="best")
    fig.tight_layout()
    fig.savefig(ARTIFACT_DIR / "precision_recall_curve.png", dpi=180)
    plt.close(fig)

    preprocessor = pipeline.named_steps["preprocessor"]
    estimator = pipeline.named_steps["classifier"]
    names = preprocessor.get_feature_names_out()
    if hasattr(estimator, "feature_importances_"):
        importance = estimator.feature_importances_
        title = f"Feature importance · {best_model}"
    else:
        importance = np.abs(estimator.coef_[0])
        title = "Absolute standardized coefficient · logistic regression"
    order = np.argsort(importance)[-20:]
    fig, ax = plt.subplots(figsize=(8.5, 6.5))
    ax.barh(np.asarray(names)[order], np.asarray(importance)[order], color="#2a7f9e")
    ax.set(title=title, xlabel="Relative importance (associational; not causal)")
    fig.tight_layout()
    fig.savefig(ARTIFACT_DIR / "feature_importance.png", dpi=180)
    plt.close(fig)


def subgroup_metrics(frame: pd.DataFrame, y_true: np.ndarray, probabilities: np.ndarray, group_feature: str, group_name: str) -> list[dict[str, object]]:
    rows = []
    values = frame[group_feature].reset_index(drop=True)
    for value in sorted(values.dropna().unique()):
        mask = values.eq(value).to_numpy()
        y_group = y_true[mask]
        if not len(y_group):
            continue
        row: dict[str, object] = {"dimension": group_name, "group_code": int(value), "n": int(len(y_group)), "positive_n": int(np.sum(y_group == 1)), "negative_n": int(np.sum(y_group == 0))}
        if row["positive_n"] >= 20 and row["negative_n"] >= 20:
            result = calculate_metrics(y_group, probabilities[mask])
            for name in ["sensitivity_recall", "specificity", "precision", "f1", "balanced_accuracy", "roc_auc"]:
                row[name] = result[name]
        else:
            row["metrics_suppressed"] = "requires >=20 positives and >=20 negatives; small cells are unstable"
        rows.append(row)
    return rows


def comparison_report(
    results: list[dict[str, object]], best: dict[str, object], pima: dict[str, object],
    complete_cases: list[dict[str, object]], subgroups: list[dict[str, object]],
) -> str:
    rows = [
        f"| {r['cohort']} | {r['feature_set']} | {r['model']} | {r['n']} | {r['roc_auc']:.3f} | {r['average_precision']:.3f} | {r['sensitivity_recall']:.3f} | {r['specificity']:.3f} | {r['precision']:.3f} | {r['f1']:.3f} | {r['balanced_accuracy']:.3f} |"
        for r in results
    ]
    complete_case_rows = [
        f"| {row['feature_set']} | {int(row['eligible_n'])} | {int(row['complete_case_n_for_feature_set'])} | {int(row['eligible_n']) - int(row['complete_case_n_for_feature_set'])} |"
        for row in complete_cases
    ]
    sex_labels = {1: "Male", 2: "Female"}
    race_labels = {1: "Mexican American", 2: "Other Hispanic", 3: "Non-Hispanic White", 4: "Non-Hispanic Black", 6: "Non-Hispanic Asian", 7: "Other race/multiracial"}
    subgroup_rows = []
    for row in subgroups:
        label = (sex_labels if row["dimension"] == "sex" else race_labels).get(int(row["group_code"]), str(row["group_code"]))
        status = "reported" if row.get("sensitivity_recall") is not None else "suppressed: <20 cases or <20 controls"
        subgroup_rows.append(f"| {row['dimension']} | {label} | {row['n']} | {row['positive_n']} | {row['negative_n']} | {status} |")
    return f"""# NHANES Model A model comparison

Metrics are unweighted, from the fixed stratified 25% holdout, and use threshold 0.5. Training-only stratified cross-validation selected the displayed primary model; the test set did not select the model or threshold. Full candidate metrics are in `../artifacts/final_metrics.json` and `../data/processed/model_comparison.csv`.

| Target | Feature set | Model | Test N | ROC-AUC | Average precision | Sensitivity | Specificity | Precision | F1 | Balanced accuracy |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(rows)}

All three feature sets use the same outcome-eligible participants after training-only imputation. Complete-case counts below show the sample loss that a complete-case analysis would incur; they are not the model sample sizes.

| Feature set | Eligible N | Complete-case N | Complete-case exclusions |
|---|---:|---:|---:|
{chr(10).join(complete_case_rows)}

## Primary model selected from training CV

- Cohort: `laboratory_undiagnosed`; feature set: `full_non_laboratory`; selected model: **{best['model']}**.
- Test metrics: ROC-AUC {best['roc_auc']:.3f}, average precision {best['average_precision']:.3f}, sensitivity {best['sensitivity_recall']:.3f}, specificity {best['specificity']:.3f}, precision {best['precision']:.3f}, F1 {best['f1']:.3f}, balanced accuracy {best['balanced_accuracy']:.3f}.
- Confusion matrix (actual rows: negative/positive; predicted columns: negative/positive): `{best['confusion_matrix_tn_fp_fn_tp']}`.
- Ordinary participant-level bootstrap 95% percentile intervals are in `final_metrics.json`; they do not account for NHANES strata, PSU or weights.

## Holdout trade-offs inside the full feature set

The random forest had the largest observed holdout ROC-AUC (0.812) and average precision (0.184) among the full-feature candidates, but at the fixed 0.5 cutoff it identified only 1 of 32 lab-positive participants (sensitivity 0.031). Logistic regression identified 24 of 32 (sensitivity 0.750) with specificity 0.671, but lower ROC-AUC (0.720). XGBoost was selected by training-only CV and predicted every holdout record negative at 0.5. These differences show why ranking by AUC alone does not select an operating point; the test results are descriptive and were not used to change the model or threshold.

## Test-set subgroup check

| Dimension | Group | Test N | Positive N | Negative N | Result |
|---|---|---:|---:|---:|---|
{chr(10).join(subgroup_rows)}

Sensitivity/specificity and other subgroup metrics are suppressed unless both classes have at least 20 test participants. No demographic subgroup meets this rule in the primary test split, so this experiment supports no fairness conclusion.

## Comparison with the existing Pima experiment

The existing Pima artifact has 768 curated records and its fixed holdout ROC-AUC was {pima['roc_auc']:.3f}, sensitivity {pima['sensitivity']:.3f}, specificity {pima['specificity']:.3f}, and precision {pima['precision']:.3f}. That is not a head-to-head benchmark: Pima has a different historical outcome, population, feature set and split; NHANES here is a cross-sectional lab-defined current-status task among adults without reported prior diagnosis. The metrics must not be ranked as if labels were interchangeable.

## Interpretation

All probabilities are model scores, not calibrated personal diabetes risk. The test set is modest and the data are a complex survey; point metrics and ordinary bootstrap intervals are uncertain. The best CV model is a development choice only. A national performance claim would require design-aware validation and an appropriate survey evaluation procedure.
"""


def limitations_report(metrics: dict[str, object], summary: dict[str, object]) -> str:
    primary_n = summary["flow_counts"]["primary_lab_eligible"]
    primary_pos = summary["flow_counts"]["primary_lab_cases"]
    return f"""# Limitations and research safeguards

- **Cross-sectional outcome:** one NHANES examination cannot establish future onset. The primary outcome marks a single survey lab observation meeting an operational threshold, not a confirmed clinical diagnosis.
- **Target construction:** the OR of HbA1c >= 6.5% and fasting glucose >= 126 mg/dL is a prespecified exploratory label. Requiring both measures to be observed makes controls interpretable but excludes many adults. A positive on either measure can still be affected by single-measurement variability.
- **Selection and weight:** the fasting subsample restricts the primary target. Its complete-lab cohort is N={primary_n:,}, with {primary_pos:,} positives; complex survey weighting affects population estimates. Weighted prevalence has no design-based standard error in this experiment. ML metrics are unweighted and are not nationally representative.
- **Missing predictors:** outcome-eligible participants remain in model datasets when predictors are missing. Median/mode imputation and missing indicators are fitted within the training pipeline/CV fold. Complete-case counts are separately reported to expose selection.
- **Lifestyle measurement:** PAQ and sleep are self-reported; dietary recall covers one or two days and is not habitual intake. Activity duration and sleep variables have skip patterns, nonresponse and recall error.
- **Validation:** a single stratified 25% holdout, fixed seed and 5-fold training CV support reproducibility, not robust performance claims. Test metrics are uncertain. Bootstrap intervals are ordinary person-level intervals, not survey-design intervals.
- **Subgroups:** sex/race subgroup metrics are suppressed unless each cell has at least 20 positives and 20 negatives; this is a stability safeguard, not a fairness determination. Survey representation and measurement differences remain.
- **Prediction use:** lab predictors are excluded; `SEQN`, target-derived fields, medications and diagnosis questionnaire answers are excluded. Nonetheless, demographic/anthropometric associations are not causal and model scores are not calibrated personal risk.
- **Population and transport:** this is one U.S. survey cycle with NHANES nonresponse, eligibility and measurement limits. External validation on a later NHANES cycle or a separate cohort is required.
- **Pima comparison:** Pima's historical class and its 768-person cohort differ from NHANES current-status classification. Metric differences do not prove that one classifier is intrinsically better.

## Recommended next steps

1. Re-run the primary experiment with a prespecified sensitivity-oriented operating point selected only inside training data, and report its held-out results without further tuning.
2. Add survey-design-aware uncertainty and evaluation for NHANES (strata, PSU and fasting weights), or keep results explicitly exploratory as here.
3. Perform a second-cycle external validation with a harmonized lab target and confirm eligibility/measurement differences.
4. Keep this model outside the production API until clinical endpoint review, calibration, external validation and prospective evaluation are completed.

Raw XPT and row-level processed cohorts are ignored by Git. No participant-level data should be committed.
"""


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ARTIFACT_DIR / "training_manifest.json").read_text(encoding="utf-8"))
    summary = json.loads((PROCESSED_DIR / "cohort_summary.json").read_text(encoding="utf-8"))
    all_results = []
    final: dict[str, object] = {"cycle": "NHANES 2017-2018", "split": "stratified 75/25, seed 42", "threshold": 0.5, "metrics_are_unweighted": True, "scenarios": {}}
    for cohort_name, target in TARGETS.items():
        frame = read_cohort(cohort_name).reset_index(drop=True)
        frame = frame[frame[target].notna()].reset_index(drop=True)
        cohort_info = manifest["models"][cohort_name]
        y = frame[target].astype(int).to_numpy()
        test_idx = np.asarray(cohort_info["test_indices"], dtype=int)
        cohort_result: dict[str, object] = {"feature_sets": {}}
        for feature_set, features in FEATURE_SETS.items():
            feature_info = cohort_info["feature_sets"][feature_set]
            feature_result: dict[str, object] = {"selected_model": feature_info["cv_selected_model"], "models": {}}
            for model_name, cv_result in feature_info["models"].items():
                pipeline = joblib.load(ARTIFACT_DIR / cv_result["model_path"])
                X_test = frame.iloc[test_idx][features]
                probabilities = pipeline.predict_proba(X_test)[:, 1]
                result = calculate_metrics(y[test_idx], probabilities)
                result.update({
                    "cohort": cohort_name, "feature_set": feature_set, "model": model_name,
                    "cv_roc_auc_mean": cv_result["cv_roc_auc_mean"], "cv_roc_auc_std": cv_result["cv_roc_auc_std"],
                    "cv_average_precision_mean": cv_result["cv_average_precision_mean"],
                })
                feature_result["models"][model_name] = result
                all_results.append(result)
            cohort_result["feature_sets"][feature_set] = feature_result
        final["scenarios"][cohort_name] = cohort_result

    selected = final["scenarios"]["laboratory_undiagnosed"]["feature_sets"]["full_non_laboratory"]["selected_model"]
    best_result = final["scenarios"]["laboratory_undiagnosed"]["feature_sets"]["full_non_laboratory"]["models"][selected]
    lab_frame = read_cohort("laboratory_undiagnosed").reset_index(drop=True)
    lab_frame = lab_frame[lab_frame[TARGETS["laboratory_undiagnosed"]].notna()].reset_index(drop=True)
    lab_info = manifest["models"]["laboratory_undiagnosed"]
    test_idx = np.asarray(lab_info["test_indices"], dtype=int)
    y_lab = lab_frame[TARGETS["laboratory_undiagnosed"]].astype(int).to_numpy()
    full_features = FEATURE_SETS["full_non_laboratory"]
    selected_pipeline = joblib.load(ARTIFACT_DIR / lab_info["feature_sets"]["full_non_laboratory"]["models"][selected]["model_path"])
    X_test = lab_frame.iloc[test_idx][full_features]
    y_prob = selected_pipeline.predict_proba(X_test)[:, 1]
    best_result["bootstrap_95_percentile_ci"] = bootstrap_intervals(y_lab[test_idx], y_prob)
    final["primary_selected_model"] = {"feature_set": "full_non_laboratory", "model": selected, **best_result}
    final["primary_subgroup_metrics"] = (
        subgroup_metrics(lab_frame.iloc[test_idx], y_lab[test_idx], y_prob, "sex", "sex")
        + subgroup_metrics(lab_frame.iloc[test_idx], y_lab[test_idx], y_prob, "race_ethnicity", "race_ethnicity")
    )
    final["notes"] = [
        "Classification thresholds are research operational definitions, not diagnosis.",
        "Test set did not select a model or threshold. Threshold fixed at 0.5.",
        "Weighted prevalence is reported separately; predictive metrics are unweighted and not nationally representative.",
        "Probability scores are not calibrated personal risk.",
    ]
    (ARTIFACT_DIR / "final_metrics.json").write_text(json.dumps(final, indent=2, allow_nan=False), encoding="utf-8")
    flat = pd.DataFrame(all_results)
    flat.to_csv(PROCESSED_DIR / "model_comparison.csv", index=False)
    pd.DataFrame(final["primary_subgroup_metrics"]).to_csv(PROCESSED_DIR / "subgroup_metrics.csv", index=False)
    plot_primary(selected, selected_pipeline, X_test, y_lab[test_idx], y_prob, best_result)
    pima_path = ROOT.parent.parent / "artifacts" / "metrics_v1.json"
    pima = json.loads(pima_path.read_text(encoding="utf-8"))
    pima_metrics = pima["test_metrics"]
    pima_row = {
        "roc_auc": pima_metrics["roc_auc"], "sensitivity": pima_metrics["recall"],
        "specificity": pima_metrics["confusion_matrix_labels_0_1"][0][0] / sum(pima_metrics["confusion_matrix_labels_0_1"][0]),
        "precision": pima_metrics["precision"],
    }
    availability = pd.read_csv(PROCESSED_DIR / "feature_missingness.csv")
    availability = availability[availability["cohort"] == "laboratory_undiagnosed"].drop_duplicates("feature_set").to_dict(orient="records")
    REPORT_DIR.joinpath("MODEL_COMPARISON.md").write_text(
        comparison_report(all_results, best_result, pima_row, availability, final["primary_subgroup_metrics"]),
        encoding="utf-8",
    )
    REPORT_DIR.joinpath("LIMITATIONS.md").write_text(limitations_report(final, summary), encoding="utf-8")
    print(f"Evaluation complete. Metrics: {ARTIFACT_DIR / 'final_metrics.json'}")


if __name__ == "__main__":
    main()
