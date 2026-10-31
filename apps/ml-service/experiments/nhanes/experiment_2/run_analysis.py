"""Experiment 2: training-only thresholding, class imbalance and calibration."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib

BASE = Path(__file__).resolve().parents[1]
EXP2 = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))
MPLCONFIGDIR = EXP2 / "plots" / ".mplconfig"
MPLCONFIGDIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIGDIR))
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score, balanced_accuracy_score, brier_score_loss,
    confusion_matrix, f1_score, log_loss as sklearn_log_loss,
    precision_score, recall_score, roc_auc_score, roc_curve,
    precision_recall_curve,
)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from common import ARTIFACT_DIR as EXP1_ARTIFACTS
from common import FEATURE_SETS, PROCESSED_DIR, make_preprocessor, read_cohort


SEED = 20261031
N_SPLITS = 5
N_REPEATS = 5
BOOTSTRAPS = 2000
THRESHOLDS = np.round(np.arange(0.05, 0.951, 0.05), 2)
SENSITIVITY_TARGET = 0.80
FEATURE_SET = "full_non_laboratory"
FEATURES = FEATURE_SETS[FEATURE_SET]
TARGET = "lab_diabetes"
MODEL_NAMES = [
    "exp1_logistic_balanced",
    "exp1_random_forest_balanced_subsample",
    "exp1_xgboost_unweighted",
    "xgboost_scale_pos_weight",
]


class FoldWeightedXGBClassifier(ClassifierMixin, BaseEstimator):
    """XGB wrapper deriving scale_pos_weight from the y passed to each fit."""

    def __init__(self, n_estimators: int = 120, max_depth: int = 3, learning_rate: float = 0.05,
                 subsample: float = 0.9, colsample_bytree: float = 0.9, reg_lambda: float = 1.0,
                 random_state: int = SEED, n_jobs: int = 2):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.n_jobs = n_jobs

    def fit(self, X, y):
        y_arr = np.asarray(y, dtype=int)
        positive = int(np.sum(y_arr == 1))
        negative = int(np.sum(y_arr == 0))
        if positive == 0 or negative == 0:
            raise ValueError("Both classes are required to derive scale_pos_weight")
        self.scale_pos_weight_ = negative / positive
        self.classes_ = np.array([0, 1])
        self.n_features_in_ = X.shape[1]
        self.estimator_ = XGBClassifier(
            n_estimators=self.n_estimators, max_depth=self.max_depth, learning_rate=self.learning_rate,
            subsample=self.subsample, colsample_bytree=self.colsample_bytree, reg_lambda=self.reg_lambda,
            scale_pos_weight=self.scale_pos_weight_, eval_metric="logloss", random_state=self.random_state,
            n_jobs=self.n_jobs, verbosity=0,
        )
        self.estimator_.fit(X, y_arr)
        return self

    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)

    def predict(self, X):
        return self.estimator_.predict(X)


def estimator_for(model_name: str):
    if model_name == "exp1_logistic_balanced":
        return LogisticRegression(max_iter=2000, class_weight="balanced", random_state=SEED)
    if model_name == "exp1_random_forest_balanced_subsample":
        return RandomForestClassifier(
            n_estimators=300, min_samples_leaf=3, max_features="sqrt", class_weight="balanced_subsample",
            random_state=SEED, n_jobs=2,
        )
    if model_name == "exp1_xgboost_unweighted":
        return XGBClassifier(
            n_estimators=120, max_depth=3, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9,
            reg_lambda=1.0, eval_metric="logloss", random_state=SEED, n_jobs=2, verbosity=0,
        )
    if model_name == "xgboost_scale_pos_weight":
        return FoldWeightedXGBClassifier(random_state=SEED, n_jobs=2)
    raise KeyError(model_name)


def make_pipeline(model_name: str) -> Pipeline:
    return Pipeline([
        ("preprocessor", make_preprocessor(FEATURES, scale_numeric=model_name == "exp1_logistic_balanced")),
        ("classifier", estimator_for(model_name)),
    ])


def get_split_and_cohort():
    frame = read_cohort("laboratory_undiagnosed").reset_index(drop=True)
    original_manifest = json.loads((EXP1_ARTIFACTS / "training_manifest.json").read_text(encoding="utf-8"))
    split = original_manifest["models"]["laboratory_undiagnosed"]
    train_original = np.asarray(split["train_indices"], dtype=int)
    test_original = np.asarray(split["test_indices"], dtype=int)
    if len(frame) != split["n"] or len(train_original) + len(test_original) != len(frame):
        raise ValueError("Experiment 1 saved split does not match its processed cohort")
    # pandas decodes the 2017-18 XPT's documented WTSAF2YR=0 values as the
    # SAS extended-missing marker. The CDC GLU_J codebook identifies zero as
    # no fasting subsample weight / not fasted for 8 to <24 hours.
    valid_fast_weight = pd.to_numeric(frame["WTSAF2YR"], errors="coerce").gt(0).to_numpy()
    train_valid = train_original[valid_fast_weight[train_original]]
    test_valid = test_original[valid_fast_weight[test_original]]
    x_train = frame.iloc[train_valid][FEATURES].reset_index(drop=True)
    y_train = frame.iloc[train_valid][TARGET].astype(int).reset_index(drop=True)
    x_test = frame.iloc[test_valid][FEATURES].reset_index(drop=True)
    y_test = frame.iloc[test_valid][TARGET].astype(int).reset_index(drop=True)
    return frame, split, train_original, test_original, train_valid, test_valid, x_train, y_train, x_test, y_test


def metric_values(y_true: np.ndarray, probabilities: np.ndarray, threshold: float) -> dict[str, float | int]:
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    predicted = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predicted, labels=[0, 1]).ravel()
    sensitivity = float(tp / (tp + fn)) if tp + fn else float("nan")
    specificity = float(tn / (tn + fp)) if tn + fp else float("nan")
    precision = float(tp / (tp + fp)) if tp + fp else 0.0
    f1 = float(f1_score(y_true, predicted, zero_division=0))
    return {
        "n": int(len(y_true)), "positive_n": int(np.sum(y_true == 1)), "negative_n": int(np.sum(y_true == 0)),
        "sensitivity": sensitivity, "specificity": specificity, "precision": precision, "f1": f1,
        "balanced_accuracy": float(balanced_accuracy_score(y_true, predicted)),
        "false_positive_n": int(fp), "false_negative_n": int(fn), "true_positive_n": int(tp), "true_negative_n": int(tn),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "threshold": float(threshold),
    }


def threshold_selection(oof_y: np.ndarray, oof_prob: np.ndarray) -> dict[str, dict[str, float | str | None]]:
    rows = [metric_values(oof_y, oof_prob, float(threshold)) for threshold in THRESHOLDS]
    youden = max(rows, key=lambda row: (row["sensitivity"] + row["specificity"] - 1, row["threshold"]))
    best_f1 = max(rows, key=lambda row: (row["f1"], row["threshold"]))
    eligible = [row for row in rows if row["sensitivity"] >= SENSITIVITY_TARGET]
    sensitivity_row = max(eligible, key=lambda row: row["threshold"]) if eligible else None
    out = {
        "youden_j": {"threshold": youden["threshold"], "training_oof_j": youden["sensitivity"] + youden["specificity"] - 1},
        "f1_optimized": {"threshold": best_f1["threshold"], "training_oof_f1": best_f1["f1"]},
        "sensitivity_80": {
            "threshold": sensitivity_row["threshold"] if sensitivity_row else None,
            "training_oof_sensitivity": sensitivity_row["sensitivity"] if sensitivity_row else None,
            "status": "achieved" if sensitivity_row else "not achieved on the 0.05–0.95 grid",
        },
        "fixed_0_5": {"threshold": 0.5, "selection": "prespecified reference; not optimized"},
    }
    return out


def wilson(success: int, total: int, z: float = 1.959963984540054) -> list[float] | None:
    if total <= 0:
        return None
    p = success / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    half = z * np.sqrt((p * (1 - p) / total) + z * z / (4 * total * total)) / denom
    return [float(max(0, centre - half)), float(min(1, centre + half))]


def bootstrap_cis(y: np.ndarray, probs: np.ndarray, threshold: float, iterations: int = BOOTSTRAPS) -> dict[str, object]:
    # Stratify the ordinary bootstrap by outcome so every replicate contains
    # the observed 27 cases and 428 controls; this is conditional uncertainty,
    # not a NHANES design-based interval.
    y = np.asarray(y, dtype=int)
    pos = np.flatnonzero(y == 1)
    neg = np.flatnonzero(y == 0)
    rng = np.random.default_rng(SEED)
    values: dict[str, list[float]] = {k: [] for k in ["sensitivity", "specificity", "precision", "f1", "balanced_accuracy", "roc_auc", "average_precision", "brier_score"]}
    for _ in range(iterations):
        idx = np.concatenate([rng.choice(pos, len(pos), replace=True), rng.choice(neg, len(neg), replace=True)])
        m = metric_values(y[idx], probs[idx], threshold)
        for key in values:
            values[key].append(float(m[key]))
    return {key: [float(np.quantile(v, .025)), float(np.quantile(v, .975))] for key, v in values.items()} | {"replicates": iterations}


def subgroup_results(frame: pd.DataFrame, y: np.ndarray, prob_by_model: dict[str, np.ndarray], thresholds: dict[str, dict[str, dict[str, object]]]) -> pd.DataFrame:
    labels = {
        "sex": {1: "Male", 2: "Female"},
        "race_ethnicity": {1: "Mexican American", 2: "Other Hispanic", 3: "Non-Hispanic White", 4: "Non-Hispanic Black", 6: "Non-Hispanic Asian", 7: "Other race/multiracial"},
    }
    groups = frame["age_years"].reset_index(drop=True).map(
        lambda age: "20-39" if age < 40 else "40-59" if age < 60 else "60+"
    )
    group_specs: list[tuple[str, pd.Series, dict[object, str]]] = [("age_group", groups, {})]
    for feature, dimension in [("sex", "sex"), ("race_ethnicity", "race_ethnicity")]:
        series = frame[feature].reset_index(drop=True)
        group_specs.append((dimension, series, labels[dimension]))
    rows = []
    for model_name, probabilities in prob_by_model.items():
        threshold = thresholds[model_name]["youden_j"]["threshold"]
        for dimension, series, mapping in group_specs:
            for value in sorted(series.dropna().unique(), key=str):
                mask = series.eq(value).to_numpy()
                y_group = y[mask]
                p_group = probabilities[mask]
                pred = p_group >= float(threshold)
                positive_n = int(np.sum(y_group == 1))
                negative_n = int(np.sum(y_group == 0))
                tp = int(np.sum(pred & (y_group == 1)))
                tn = int(np.sum((~pred) & (y_group == 0)))
                rows.append({
                    "model": model_name, "threshold_rule": "Youden selected on training OOF", "threshold": threshold,
                    "dimension": dimension, "group": mapping.get(int(value), str(value)) if dimension != "age_group" else str(value),
                    "n": int(len(y_group)), "positive_n": positive_n, "negative_n": negative_n,
                    "sensitivity": tp / positive_n if positive_n else None, "sensitivity_wilson_95ci": wilson(tp, positive_n),
                    "specificity": tn / negative_n if negative_n else None, "specificity_wilson_95ci": wilson(tn, negative_n),
                    "interpretation": "unstable: <10 positives or <10 negatives" if positive_n < 10 or negative_n < 10 else "exploratory; not a fairness determination",
                })
    return pd.DataFrame(rows)


def reliability_bins(y: np.ndarray, prob: np.ndarray, n_bins: int = 5) -> list[dict[str, object]]:
    frame = pd.DataFrame({"y": y, "prob": prob}).sort_values("prob").reset_index(drop=True)
    frame["bin"] = pd.qcut(frame.index, q=n_bins, labels=False, duplicates="drop")
    bins = []
    for bin_id, part in frame.groupby("bin", observed=True):
        cases = int(part["y"].sum())
        n = int(len(part))
        bins.append({
            "bin": int(bin_id), "n": n, "positive_n": cases,
            "mean_predicted_probability": float(part["prob"].mean()),
            "observed_positive_fraction": cases / n,
            "observed_fraction_wilson_95ci": wilson(cases, n),
        })
    return bins


def main() -> None:
    out_reports = EXP2 / "reports"
    out_plots = EXP2 / "plots"
    out_reports.mkdir(parents=True, exist_ok=True)
    out_plots.mkdir(parents=True, exist_ok=True)

    frame, original_split, train_original, test_original, train_valid, test_valid, X_train, y_train, X_test, y_test = get_split_and_cohort()
    original_valid_train = int(len(train_valid))
    original_valid_test = int(len(test_valid))
    if y_train.value_counts().min() < N_SPLITS or y_test.nunique() != 2:
        raise ValueError("Valid-weight train/test partitions are too small for requested stratified analysis")

    # Methodology audit and the reason fasting weight eligibility changes N.
    audit = {
        "experiment": 2,
        "original_split": {
            "method": "sklearn train_test_split over saved positional indices",
            "test_size": original_split["n"] and len(test_original) / len(frame),
            "random_state": 42,
            "stratified": True,
            "original_n": len(frame),
            "original_train_n": len(train_original),
            "original_test_n": len(test_original),
            "original_test_classes": {str(k): int(v) for k, v in frame.iloc[test_original][TARGET].value_counts().sort_index().items()},
        },
        "valid_fasting_weight_filter": {
            "rule": "WTSAF2YR > 0",
            "reason": "CDC GLU_J codebook assigns zero weight when no fasting lab result exists or specimen did not meet the 8 to <24 hour fasting criterion; fasting-glucose results are retained for some nonfasted participants, but using them in the fasting analysis requires reweighting.",
            "experiment1_rows_without_positive_weight": int(len(frame) - frame["WTSAF2YR"].fillna(0).gt(0).sum()),
            "of_these_with_complete_labs_and_primary_eligibility": int((~frame["WTSAF2YR"].fillna(0).gt(0)).sum()),
            "valid_weighted_point_estimate_n_in_exp1": 1823,
            "exp2_valid_cohort_n": int(original_valid_train + original_valid_test),
            "exp2_train_n": original_valid_train,
            "exp2_train_classes": {str(k): int(v) for k, v in y_train.value_counts().sort_index().items()},
            "exp2_test_n": original_valid_test,
            "exp2_test_classes": {str(k): int(v) for k, v in y_test.value_counts().sort_index().items()},
        },
        "preprocessing_audit": {
            "preprocessor_inside_sklearn_pipeline": True,
            "imputation_scaling_fitted_per_training_fold": True,
            "feature_set": FEATURE_SET,
            "feature_set_prespecified": True,
            "no_data_driven_feature_selection": True,
            "threshold_selection_data": "repeated stratified out-of-fold predictions from valid-weight training participants only",
            "test_data_used_for_threshold_or_calibration_fit": False,
        },
        "survey_weights": {
            "WTSAF2YR": "eligibility filter and weighted prevalence context only; not passed as an ML sample_weight",
            "SDMVSTRA_SDMVPSU": "retained in Exp1 cohort file but not used in ordinary ML metrics or bootstrap; no design-based performance estimate",
        },
    }
    (EXP2 / "methodology_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")

    # Repeated CV produces one honest OOF score per training row per repeat.
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=SEED)
    oof_sum = {name: np.zeros(len(y_train), dtype=float) for name in MODEL_NAMES}
    oof_count = {name: np.zeros(len(y_train), dtype=int) for name in MODEL_NAMES}
    fold_rows = []
    for fold_number, (fit_idx, validation_idx) in enumerate(cv.split(X_train, y_train), start=1):
        repeat = (fold_number - 1) // N_SPLITS + 1
        fold = (fold_number - 1) % N_SPLITS + 1
        for model_name in MODEL_NAMES:
            pipeline = make_pipeline(model_name)
            pipeline.fit(X_train.iloc[fit_idx], y_train.iloc[fit_idx])
            prob = pipeline.predict_proba(X_train.iloc[validation_idx])[:, 1]
            oof_sum[model_name][validation_idx] += prob
            oof_count[model_name][validation_idx] += 1
            fold_rows.append({
                "model": model_name, "repeat": repeat, "fold": fold,
                "n_train": int(len(fit_idx)), "train_positive_n": int(y_train.iloc[fit_idx].sum()),
                "n_validation": int(len(validation_idx)), "validation_positive_n": int(y_train.iloc[validation_idx].sum()),
                "roc_auc": float(roc_auc_score(y_train.iloc[validation_idx], prob)),
                "average_precision": float(average_precision_score(y_train.iloc[validation_idx], prob)),
                "brier_score": float(brier_score_loss(y_train.iloc[validation_idx], prob)),
                "scale_pos_weight": float(pipeline.named_steps["classifier"].scale_pos_weight_) if model_name == "xgboost_scale_pos_weight" else None,
            })
    for name in MODEL_NAMES:
        if not np.all(oof_count[name] == N_REPEATS):
            raise RuntimeError(f"OOF prediction count is incomplete for {name}")
    oof_probability = {name: oof_sum[name] / N_REPEATS for name in MODEL_NAMES}
    pd.DataFrame(fold_rows).to_csv(EXP2 / "fold_metrics.csv", index=False)

    threshold_rows = []
    selections = {}
    oof_summary = {}
    for model_name in MODEL_NAMES:
        selections[model_name] = threshold_selection(y_train.to_numpy(), oof_probability[model_name])
        oof_summary[model_name] = {
            "n": int(len(y_train)), "positive_n": int(y_train.sum()),
            "roc_auc": float(roc_auc_score(y_train, oof_probability[model_name])),
            "average_precision": float(average_precision_score(y_train, oof_probability[model_name])),
            "brier_score": float(brier_score_loss(y_train, oof_probability[model_name])),
            "thresholds_selected_from_oof": selections[model_name],
        }
        for threshold in THRESHOLDS:
            values = metric_values(y_train.to_numpy(), oof_probability[model_name], float(threshold))
            threshold_rows.append({"evaluation_partition": "training_repeated_oof", "model": model_name, "threshold_rule": "grid", **values})

    # Fit full valid-training candidates, then evaluate the saved untouched-test rows once.
    final_pipelines = {}
    test_probability = {}
    holdout_threshold_rows = []
    holdout_cis = {}
    for model_name in MODEL_NAMES:
        pipeline = make_pipeline(model_name)
        pipeline.fit(X_train, y_train)
        final_pipelines[model_name] = pipeline
        prob = pipeline.predict_proba(X_test)[:, 1]
        test_probability[model_name] = prob
        for rule, info in selections[model_name].items():
            threshold = info["threshold"]
            if threshold is None:
                continue
            values = metric_values(y_test.to_numpy(), prob, float(threshold))
            row = {"evaluation_partition": "untouched_holdout", "model": model_name, "threshold_rule": rule, **values}
            threshold_rows.append(row)
            holdout_threshold_rows.append(row)
            if rule in ["youden_j", "f1_optimized", "sensitivity_80", "fixed_0_5"]:
                holdout_cis[f"{model_name}__{rule}"] = bootstrap_cis(y_test.to_numpy(), prob, float(threshold))

    for row in holdout_threshold_rows:
        ci = holdout_cis.get(f"{row['model']}__{row['threshold_rule']}")
        if ci:
            for metric, interval in ci.items():
                if metric != "replicates":
                    row[f"{metric}_bootstrap_95ci"] = interval
    (EXP2 / "holdout_bootstrap_cis.json").write_text(json.dumps(holdout_cis, indent=2), encoding="utf-8")

    # Re-evaluate the frozen Exp1 selected XGBoost artifact at its original 0.5
    # cutoff on the valid-weight subset only; do not retune it on this holdout.
    exp1_model_path = EXP1_ARTIFACTS / "models" / f"laboratory_undiagnosed__{FEATURE_SET}__xgboost.joblib"
    exp1_frozen = joblib.load(exp1_model_path)
    exp1_frozen_prob = exp1_frozen.predict_proba(X_test)[:, 1]
    frozen_result = metric_values(y_test.to_numpy(), exp1_frozen_prob, 0.5)
    threshold_rows.append({
        "evaluation_partition": "untouched_holdout_reference_only", "model": "exp1_frozen_selected_xgboost",
        "threshold_rule": "fixed_0_5_only; no Experiment 2 threshold transfer", **frozen_result,
    })
    pd.DataFrame(threshold_rows).to_csv(EXP2 / "threshold_metrics.csv", index=False)
    (EXP2 / "threshold_selection.json").write_text(json.dumps(selections, indent=2), encoding="utf-8")

    # Calibration fit uses only valid training data. Every base pipeline has
    # its own fold-local preprocessing; class ratio for weighted XGB is derived
    # within each internal fit via FoldWeightedXGBClassifier.
    calibrators = {}
    calibration_results = {}
    for model_name in MODEL_NAMES:
        calibration_cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED + 1)
        calibrated = CalibratedClassifierCV(
            estimator=make_pipeline(model_name), method="sigmoid", cv=calibration_cv,
            ensemble=True, n_jobs=1,
        )
        calibrated.fit(X_train, y_train)
        calibrators[model_name] = calibrated
        calibrated_prob = calibrated.predict_proba(X_test)[:, 1]
        raw_prob = test_probability[model_name]
        calibration_results[model_name] = {
            "training_oof_raw_brier_score": oof_summary[model_name]["brier_score"],
            "holdout_raw": {
                "brier_score": float(brier_score_loss(y_test, raw_prob)),
                "brier_score_stratified_bootstrap_95ci": bootstrap_cis_for_probability(y_test.to_numpy(), raw_prob)["brier_score"],
                "roc_auc": float(roc_auc_score(y_test, raw_prob)),
                "average_precision": float(average_precision_score(y_test, raw_prob)),
                "mean_predicted_probability": float(np.mean(raw_prob)),
                "reliability_bins": reliability_bins(y_test.to_numpy(), raw_prob),
            },
            "holdout_sigmoid_calibrated": {
                "brier_score": float(brier_score_loss(y_test, calibrated_prob)),
                "brier_score_stratified_bootstrap_95ci": bootstrap_cis_for_probability(y_test.to_numpy(), calibrated_prob)["brier_score"],
                "log_loss": float(sklearn_log_loss(y_test, calibrated_prob, labels=[0, 1])),
                "roc_auc": float(roc_auc_score(y_test, calibrated_prob)),
                "average_precision": float(average_precision_score(y_test, calibrated_prob)),
                "mean_predicted_probability": float(np.mean(calibrated_prob)),
                "reliability_bins": reliability_bins(y_test.to_numpy(), calibrated_prob),
                "threshold_0_5_metrics": metric_values(y_test.to_numpy(), calibrated_prob, 0.5),
            },
        }

    weights_train = float(y_train.eq(0).sum() / y_train.eq(1).sum())
    cal_json = {
        "experiment": 2, "valid_weight_train_n": len(y_train), "train_positive_n": int(y_train.sum()),
        "valid_weight_holdout_n": len(y_test), "holdout_positive_n": int(y_test.sum()),
        "method": "CalibratedClassifierCV(method='sigmoid', ensemble=True, 5-fold stratified CV), fit on valid-weight training participants only",
        "calibration_not_fit_on_holdout": True,
        "isotonic": {
            "attempted": False,
            "reason": "Not enough independent calibration events for stable nonparametric isotonic calibration: 88 positive training cases produce roughly 17-18 positives in each 5-fold calibration validation partition. scikit-learn cautions that isotonic tends to overfit with far fewer than about 1000 calibration samples.",
        },
        "xgboost_training_scale_pos_weight_full_training_ratio": weights_train,
        "models": calibration_results,
    }
    (EXP2 / "calibration_metrics.json").write_text(json.dumps(cal_json, indent=2, allow_nan=False), encoding="utf-8")

    subgroups = subgroup_results(
        frame.iloc[test_valid].reset_index(drop=True), y_test.to_numpy(), test_probability, selections,
    )
    subgroups.to_csv(EXP2 / "subgroup_metrics.csv", index=False)

    cv_frame = pd.DataFrame(fold_rows)
    fold_summary = cv_frame.groupby("model").agg(
        folds=("fold", "size"), roc_auc_mean=("roc_auc", "mean"), roc_auc_std=("roc_auc", "std"),
        roc_auc_min=("roc_auc", "min"), roc_auc_max=("roc_auc", "max"),
        average_precision_mean=("average_precision", "mean"), average_precision_std=("average_precision", "std"),
        brier_score_mean=("brier_score", "mean"), brier_score_std=("brier_score", "std"),
    ).reset_index()
    fold_summary.to_csv(EXP2 / "repeated_cv_summary.csv", index=False)

    make_threshold_plot(oof_probability, y_train.to_numpy())
    make_holdout_roc_pr(test_probability, y_test.to_numpy())
    make_calibration_plot(calibration_results, y_test.to_numpy())
    make_confusion_plot(test_probability, y_test.to_numpy(), selections)

    write_reports(audit, selections, oof_summary, fold_summary, holdout_threshold_rows, frozen_result,
                  calibration_results, subgroups, holdout_cis, y_test)
    print(json.dumps({
        "exp2_valid_train": {"n": len(y_train), "positive": int(y_train.sum())},
        "exp2_valid_holdout": {"n": len(y_test), "positive": int(y_test.sum())},
        "selected_thresholds": selections,
        "frozen_exp1_xgboost_holdout_0_5": frozen_result,
    }, indent=2))


def bootstrap_cis_for_probability(y: np.ndarray, prob: np.ndarray, iterations: int = BOOTSTRAPS) -> dict[str, list[float]]:
    return bootstrap_cis(y, prob, 0.5, iterations)


def make_threshold_plot(oof_prob: dict[str, np.ndarray], y: np.ndarray) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    panels = [("sensitivity", "Sensitivity / recall"), ("specificity", "Specificity"), ("precision", "Precision"), ("f1", "F1"),]
    for ax, (metric, title) in zip(axes.flat, panels):
        for name, prob in oof_prob.items():
            vals = [metric_values(y, prob, float(t))[metric] for t in THRESHOLDS]
            ax.plot(THRESHOLDS, vals, marker=".", markersize=3, label=name.replace("_", " "))
        ax.set(title=title, xlabel="Threshold", ylabel=title, ylim=(0, 1.02), xlim=(0.05, 0.95))
        ax.grid(alpha=.25)
    axes[0, 0].axhline(SENSITIVITY_TARGET, color="black", linestyle="--", linewidth=1, label="80% target")
    axes[1, 1].legend(fontsize=7, loc="best")
    fig.suptitle("Experiment 2 · threshold metrics from repeated training-only OOF predictions")
    fig.tight_layout()
    fig.savefig(EXP2 / "plots" / "threshold_curves.png", dpi=170)
    plt.close(fig)


def make_holdout_roc_pr(probabilities: dict[str, np.ndarray], y: np.ndarray) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    for name, prob in probabilities.items():
        fpr, tpr, _ = roc_curve(y, prob)
        axes[0].plot(fpr, tpr, label=f"{name} AUC={roc_auc_score(y, prob):.3f}")
        precision, recall, _ = precision_recall_curve(y, prob)
        axes[1].plot(recall, precision, label=f"{name} AP={average_precision_score(y, prob):.3f}")
    axes[0].plot([0, 1], [0, 1], linestyle="--", color="gray")
    axes[0].set(xlabel="False positive rate", ylabel="True positive rate", title="Untouched holdout ROC")
    axes[1].axhline(np.mean(y), linestyle="--", color="gray", label=f"prevalence={np.mean(y):.3f}")
    axes[1].set(xlabel="Recall", ylabel="Precision", title="Untouched holdout precision–recall")
    for ax in axes:
        ax.legend(fontsize=7, loc="best")
        ax.grid(alpha=.2)
    fig.tight_layout()
    fig.savefig(EXP2 / "plots" / "holdout_roc_pr.png", dpi=170)
    plt.close(fig)


def make_calibration_plot(calibration_results: dict[str, dict[str, object]], y: np.ndarray) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(11, 10))
    for ax, (name, result) in zip(axes.flat, calibration_results.items()):
        ax.plot([0, 1], [0, 1], linestyle="--", color="black", label="ideal")
        for key, label, color in [("holdout_raw", "raw", "#2878b5"), ("holdout_sigmoid_calibrated", "sigmoid calibrated", "#d65f5f")]:
            bins = result[key]["reliability_bins"]
            mean_pred = [b["mean_predicted_probability"] for b in bins]
            observed = [b["observed_positive_fraction"] for b in bins]
            low = [b["observed_fraction_wilson_95ci"][0] for b in bins]
            high = [b["observed_fraction_wilson_95ci"][1] for b in bins]
            yerr = [np.asarray(observed) - np.asarray(low), np.asarray(high) - np.asarray(observed)]
            ax.errorbar(mean_pred, observed, yerr=yerr, marker="o", capsize=2, label=label, color=color)
        ax.set(title=name.replace("_", " "), xlabel="Mean predicted probability", ylabel="Observed positive fraction", xlim=(0, 1), ylim=(0, 1))
        ax.grid(alpha=.2)
        ax.legend(fontsize=8)
    fig.suptitle("Holdout reliability diagrams · calibration fit used training data only")
    fig.tight_layout()
    fig.savefig(EXP2 / "plots" / "reliability_diagrams.png", dpi=170)
    plt.close(fig)


def make_confusion_plot(probabilities: dict[str, np.ndarray], y: np.ndarray, selections: dict[str, dict[str, dict[str, object]]]) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(11, 9))
    for ax, (name, prob) in zip(axes.flat, probabilities.items()):
        threshold = float(selections[name]["youden_j"]["threshold"])
        pred = prob >= threshold
        tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
        matrix = np.array([[tn, fp], [fn, tp]])
        ax.imshow(matrix, cmap="Blues")
        for (i, j), val in np.ndenumerate(matrix):
            ax.text(j, i, str(int(val)), ha="center", va="center", fontsize=14)
        ax.set(xticks=[0, 1], yticks=[0, 1], xticklabels=["below", "positive"], yticklabels=["below", "positive"],
               xlabel="Predicted", ylabel="Actual", title=f"{name}\nYouden threshold={threshold:.2f}")
    fig.suptitle("Untouched holdout confusion matrices at training-OOF Youden thresholds")
    fig.tight_layout()
    fig.savefig(EXP2 / "plots" / "holdout_confusion_matrices_youden.png", dpi=170)
    plt.close(fig)


def threshold_rows_for_rule(model: str, rule: str, values: dict[str, object], threshold: float) -> str:
    return (
        f"| {model} | {rule} | {threshold:.2f} | {values['sensitivity']:.3f} | {values['specificity']:.3f} | "
        f"{values['precision']:.3f} | {values['f1']:.3f} | {values['balanced_accuracy']:.3f} | "
        f"{values['false_positive_n']} | {values['false_negative_n']} |"
    )


def write_reports(audit, selections, oof_summary, fold_summary, holdout_rows, frozen_result,
                  calibration_results, subgroups, holdout_cis, y_test) -> None:
    threshold_table_rows = []
    comparison_table_rows = []
    for row in holdout_rows:
        if row["threshold_rule"] in ["youden_j", "f1_optimized", "sensitivity_80", "fixed_0_5"]:
            threshold_table_rows.append(threshold_rows_for_rule(row["model"], row["threshold_rule"], row, row["threshold"]))
            comparison_table_rows.append(
                f"| {row['model']} | {row['threshold_rule']} | {row['threshold']:.2f} | {row['n']} | {row['positive_n']} | "
                f"{row['roc_auc']:.3f} | {row['average_precision']:.3f} | {row['sensitivity']:.3f} | "
                f"{row['specificity']:.3f} | {row['precision']:.3f} | {row['f1']:.3f} | "
                f"{row['balanced_accuracy']:.3f} | {row['false_positive_n']} | {row['false_negative_n']} |"
            )
    threshold_text = "\n".join(threshold_table_rows)
    training_selected_rows = []
    for model, info in selections.items():
        for rule, val in info.items():
            t = val["threshold"]
            if t is not None:
                training_selected_rows.append(f"| {model} | {rule} | {t:.2f} | {val.get('training_oof_j', val.get('training_oof_f1', val.get('training_oof_sensitivity', 'reference')))} |")
            else:
                training_selected_rows.append(f"| {model} | {rule} | not achieved | — |")
    cvrows = "\n".join(
        f"| {r['model']} | {int(r['folds'])} | {r['roc_auc_mean']:.3f} | {r['roc_auc_std']:.3f} | {r['roc_auc_min']:.3f}–{r['roc_auc_max']:.3f} | {r['average_precision_mean']:.3f} ± {r['average_precision_std']:.3f} | {r['brier_score_mean']:.3f} ± {r['brier_score_std']:.3f} |"
        for _, r in fold_summary.iterrows()
    )
    val80_text = "The 80% sensitivity target is available for one or more candidate(s) only where a training-OOF grid threshold was found; see the tables below and CSV for exact outcomes."
    selection_table = "\n".join(training_selected_rows)
    holdout_pos = int(np.sum(y_test == 1))
    holdout_n = int(len(y_test))
    train_oof_rows = []
    for model, s in oof_summary.items():
        train_oof_rows.append(f"| {model} | {s['n']} | {s['positive_n']} | {s['roc_auc']:.3f} | {s['average_precision']:.3f} | {s['brier_score']:.3f} |")

    (EXP2 / "THRESHOLD_ANALYSIS.md").write_text(f"""# Experiment 2 — threshold analysis

Thresholds are selected from repeated stratified out-of-fold predictions generated only within the valid-weight training partition (N={audit['valid_fasting_weight_filter']['exp2_train_n']:,}; {audit['valid_fasting_weight_filter']['exp2_train_classes']['1']} positive). The original Experiment 1 split was preserved by positional index. Participants with no positive `WTSAF2YR` were removed from both partitions because the CDC codebook assigns zero fasting weights to people not fasted 8 to <24 hours; that includes fasting-glucose values that CDC says require reweighting to use. The cleaned holdout has N={holdout_n:,}, with {holdout_pos} positive cases.

The evaluation grid is 0.05–0.95 by 0.05. The training OOF grid is in `threshold_metrics.csv`; it contains sensitivity, specificity, precision, F1, balanced accuracy, false-positive and false-negative counts for every model/threshold. Threshold rules: max Youden J; max F1; highest grid threshold with sensitivity >=80% (or explicitly not achieved); and fixed 0.50 reference. Ties are resolved toward the higher threshold. Holdout labels were not used to choose any threshold.

## OOF-selected thresholds

| Model | Rule | OOF-selected threshold | OOF selection statistic |
|---|---|---:|---:|
{selection_table}

## Untouched holdout at transferred thresholds

| Model | Rule (chosen from training OOF) | Threshold | Sensitivity | Specificity | Precision | F1 | Balanced accuracy | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
{threshold_text}

{val80_text}

The fixed 0.50 confusion matrices from Experiment 1 and Experiment 2 are not the same analysis population: Experiment 1 used 485 holdout rows including 30 with no positive fasting subsample weight; Experiment 2 evaluates the valid-weight subset. No threshold is a clinical operating point. The sensitivities/precisions are exploratory and highly uncertain with {holdout_pos} holdout events.

![OOF threshold curves](plots/threshold_curves.png)

See [`ROBUSTNESS_ANALYSIS.md`](ROBUSTNESS_ANALYSIS.md) for split and repeated-CV audit, and [`UPDATED_MODEL_COMPARISON.md`](UPDATED_MODEL_COMPARISON.md) for the decision.
""", encoding="utf-8")

    cal_rows = []
    for model, res in calibration_results.items():
        raw = res["holdout_raw"]
        cal = res["holdout_sigmoid_calibrated"]
        cal_rows.append(f"| {model} | {raw['brier_score']:.4f} | [{raw['brier_score_stratified_bootstrap_95ci'][0]:.4f}, {raw['brier_score_stratified_bootstrap_95ci'][1]:.4f}] | {cal['brier_score']:.4f} | [{cal['brier_score_stratified_bootstrap_95ci'][0]:.4f}, {cal['brier_score_stratified_bootstrap_95ci'][1]:.4f}] | {raw['roc_auc']:.3f} | {cal['roc_auc']:.3f} |")
    (EXP2 / "CALIBRATION_ANALYSIS.md").write_text(f"""# Experiment 2 — calibration analysis

Sigmoid calibration was fit independently for each candidate using `CalibratedClassifierCV(method='sigmoid', ensemble=True, cv=5)` on the valid-weight training partition only. Each base pipeline re-fits preprocessing inside its calibration fold. The untouched holdout was used only to evaluate calibration and ranking after fitting. No calibration choice or parameter was selected from holdout results.

| Model | Raw holdout Brier | Raw stratified-bootstrap 95% CI | Sigmoid holdout Brier | Sigmoid stratified-bootstrap 95% CI | Raw AUC | Sigmoid AUC |
|---|---:|---:|---:|---:|---:|---:|
{chr(10).join(cal_rows)}

Brier score evaluates probability error jointly with discrimination and outcome uncertainty; a lower Brier score alone does not prove calibration improved. Sigmoid is monotonic, so it can adjust scale while generally preserving ordering; compare its holdout AUC as well as reliability bins. Reliability diagrams use five equal-frequency holdout bins and show Wilson intervals for observed fractions. These plots are noisy because the holdout contains only {holdout_pos} cases.

Isotonic calibration was not fit. The valid-weight training set has 88 cases; in five-fold calibration, each calibrator's validation partition sees roughly 17–18 cases, far below a comfortable amount for a flexible nonparametric calibration curve. scikit-learn cautions isotonic may overfit with far fewer than about 1,000 calibration samples. This is an explicit sample-size decision, not a missing result.

The CV and calibration are unweighted. They do not provide nationally representative probabilities. Scores must not be presented as calibrated personal diabetes risk or diagnosis.

![Raw and sigmoid reliability diagrams](plots/reliability_diagrams.png)

scikit-learn calibration procedure: [CalibratedClassifierCV](https://scikit-learn.org/stable/modules/generated/sklearn.calibration.CalibratedClassifierCV.html) and [probability calibration guide](https://scikit-learn.org/stable/modules/calibration.html).
""", encoding="utf-8")

    subgroup_counts = subgroups.groupby(["dimension", "group"], sort=False).agg(n=("n", "first"), positive_n=("positive_n", "first"), negative_n=("negative_n", "first")).reset_index()
    subgroup_lines = "\n".join(f"| {r['dimension']} | {r['group']} | {r['n']} | {r['positive_n']} | {r['negative_n']} |" for _, r in subgroup_counts.iterrows())
    ci_lines = []
    for key, ci in holdout_cis.items():
        ci_lines.append(
            f"| {key} | {ci['sensitivity'][0]:.3f}–{ci['sensitivity'][1]:.3f} | "
            f"{ci['specificity'][0]:.3f}–{ci['specificity'][1]:.3f} | "
            f"{ci['precision'][0]:.3f}–{ci['precision'][1]:.3f} | "
            f"{ci['roc_auc'][0]:.3f}–{ci['roc_auc'][1]:.3f} | "
            f"{ci['average_precision'][0]:.3f}–{ci['average_precision'][1]:.3f} |"
        )
    ci_table = "\n".join(ci_lines)
    frozen = frozen_result
    frozen_text = f"Original frozen Experiment 1 selected XGBoost, threshold 0.50, on the valid-weight subset: N={frozen['n']}, positives={frozen['positive_n']}, AUC={frozen['roc_auc']:.3f}, sensitivity={frozen['sensitivity']:.3f}, specificity={frozen['specificity']:.3f}. It was trained on all original training rows, including participants now excluded for fasting-weight eligibility, and is included only as a preserved reference."
    (EXP2 / "ROBUSTNESS_ANALYSIS.md").write_text(f"""# Experiment 2 — robustness and methodology audit

## Audit of Experiment 1

- The saved manifest confirms a positional `train_test_split` with `test_size=0.25`, `random_state=42`, and `stratify=y`: 1,454 training and 485 test participants, with 97/1,357 positive/negative in training and 32/453 in test.
- All models are sklearn pipelines. The `SimpleImputer` and logistic scaling steps are inside each pipeline passed to the original five-fold `cross_validate`; they are fit separately on each training fold. Final transformations are then fit on the whole training partition. No imputation/scaling fit on the holdout was found.
- Experiment 1 used each feature set's mean five-fold training ROC-AUC to select its model. Feature sets were prespecified; there was no learned feature selection. The holdout was evaluated after that choice at fixed 0.50.
- All feature-set models share the target-eligible cohort; training-only imputation retains participants with missing predictors. Complete-case diagnostic Ns were 1,939 demographic, 1,839 demographic+anthropometric, and 1,648 full-feature. Each actual model used all 1,939 rows before the fasting eligibility correction.
- The primary lab target joins HbA1c and fasting glucose, so `WTSAF2YR` is appropriate for a weighted population point estimate. Experiment 1 used it for that point estimate and did not weight ML fitting/performance. Its model cohort nevertheless contained 116 participants without a positive fasting weight. The CDC GLU_J documentation says `WTSAF2YR=0` denotes no fasting lab result or failure to meet the 8-to-<24-hour fast requirement; some nonfasted participants still have glucose measurements, but including them in analysis requires reweighting. Because all 116 had both lab values, they were not a missing-test case; they were noneligible for the standard fasting-weight analysis and must be excluded absent reweighting. See [GLU_J codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/GLU_J.htm).
- The 116 exclusions split as 86 from Experiment 1 training and 30 from its holdout. Experiment 2 preserves the original indices then filters by positive fasting weight: train N=1,368 (88 positive); holdout N=455 (27 positive). The prior holdout had 32 positives; valid fasting-weight holdout has 27.

## Class imbalance and repeated CV

| Model | Repeated-CV folds | ROC-AUC mean ± SD | Fold min–max | Average precision mean ± SD | Brier mean ± SD |
|---|---:|---:|---:|---:|---:|
{cvrows}

The repeated design is five repetitions of stratified five-fold CV, all within the valid-weight training cohort. Fold metrics are descriptive, correlated across repeats, and their SD is variation rather than an inferential confidence interval. Thresholds use the mean of five OOF probabilities per training participant. No oversampling or SMOTE was used. LR is inverse-frequency class-weighted; RF uses `balanced_subsample`; the added XGBoost derives `scale_pos_weight = negatives / positives` within every individual model fit, never from validation or holdout labels. This follows the [XGBoost parameter guidance](https://xgboost.readthedocs.io/en/latest/parameter.html); RF weighting follows [scikit-learn class_weight semantics](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html).

## Holdout uncertainty and subgroups

Holdout sensitivity is based on only {holdout_pos} positive cases. Each additional true positive changes sensitivity by about {100/holdout_pos:.1f} percentage points. Stratified participant bootstrap intervals preserve the observed class counts and quantify conditional sampling variability; they do not account for NHANES strata, PSU or weights.

| Model/threshold rule | Sensitivity 95% CI | Specificity 95% CI | Precision 95% CI | ROC-AUC 95% CI | AP 95% CI |
|---|---:|---:|---:|---:|---:|
{ci_table}

All intervals are in `holdout_bootstrap_cis.json` and are conditional on the fixed threshold and observed case/control counts.

Subgroup counts are from the same holdout. At each model's OOF-Youden threshold, the CSV includes sensitivity/specificity and Wilson 95% intervals. These cells are small; intervals are wide and subgroup differences are not evidence of fairness or unfairness.

| Dimension | Group | N | Positive | Negative |
|---|---|---:|---:|---:|
{subgroup_lines}

No threshold or calibrator used holdout labels. The holdout is evaluated once for selected train-only thresholds and sigmoid calibration; resulting uncertainty is substantial. Model scores are not calibrated individual risk and the classification target is cross-sectional.
""", encoding="utf-8")

    best_full = None
    youden_rows = [r for r in holdout_rows if r["threshold_rule"] == "youden_j"]
    if youden_rows:
        best_full = max(youden_rows, key=lambda r: (r["roc_auc"], r["average_precision"]))
    (EXP2 / "UPDATED_MODEL_COMPARISON.md").write_text(f"""# Experiment 2 — updated model comparison

Experiment 2 corrects the target-analysis cohort to participants with a positive fasting subsample weight, while preserving the original Experiment 1 split indices. The threshold/model comparisons use full non-laboratory features and common participants: 1,368 training (88 positive) and 455 holdout (27 positive). All imputation/scaling is fold-local. Candidate names distinguish configurations; no candidate is promoted based on test performance.

| Candidate | Threshold | Test N | Positive N | ROC-AUC | AP | Sensitivity | Specificity | Precision | F1 | Balanced accuracy | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(comparison_table_rows)}

{frozen_text}

## Decision

**No candidate is sufficiently useful to retain as an experimental operating-point classifier for possible undiagnosed diabetes at this point.** Random Forest has the strongest corrected-holdout ranking metrics (ROC-AUC 0.799; average precision 0.178), but its training-OOF Youden threshold produced 70.4% sensitivity, 72.2% specificity and 13.8% precision (19 true positives, 119 false positives, 8 false negatives). Its training-OOF threshold chosen for at least 80% sensitivity produced 96.3% sensitivity but only 29.7% specificity and 8.0% precision (301 false positives, 1 false negative). With only 27 holdout cases and wide uncertainty, these results do not establish a useful operating point. The models may remain as research comparators; no model is promoted as a classifier, screening tool, or individual decision aid.

The Experiment 1 selected XGBoost's 0.5 rule predicted no positive cases; the corrected common holdout contains only 27 lab-positive participants. Alternative threshold rules can recover cases, but do so with false positives, and the observed estimates are too uncertain for a model-selection claim. The model configuration with the largest holdout AUC is not automatically the best screening classifier.

Pima remains unchanged and is not task-equivalent: its historical outcome differs from NHANES current status. NHANES is not a drop-in replacement. Recommended next step: a prospectively specified validation on a second cohort/cycle with design-aware evaluation and a sensitivity-oriented threshold fixed before opening its labels.

Experiment 2 files: [`THRESHOLD_ANALYSIS.md`](THRESHOLD_ANALYSIS.md), [`CALIBRATION_ANALYSIS.md`](CALIBRATION_ANALYSIS.md), [`ROBUSTNESS_ANALYSIS.md`](ROBUSTNESS_ANALYSIS.md), and `threshold_metrics.csv` / `calibration_metrics.json`.
""", encoding="utf-8")


if __name__ == "__main__":
    main()
