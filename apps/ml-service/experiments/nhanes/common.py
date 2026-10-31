"""Shared paths, schemas and preprocessing for the isolated NHANES experiment."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
ARTIFACT_DIR = ROOT / "artifacts"
REPORT_DIR = ROOT / "reports"
SEED = 42
TEST_SIZE = 0.25

DEMOGRAPHIC = ["age_years", "sex", "race_ethnicity"]
ANTHROPOMETRIC = ["bmi_kg_m2", "waist_cm"]
BLOOD_PRESSURE = ["systolic_mean_mmhg", "diastolic_mean_mmhg"]
LIFESTYLE = [
    "vigorous_work_days", "vigorous_work_min_day",
    "moderate_work_days", "moderate_work_min_day",
    "walk_bicycle_days", "walk_bicycle_min_day",
    "vigorous_recreation_days", "vigorous_recreation_min_day",
    "moderate_recreation_days", "moderate_recreation_min_day",
    "sedentary_min_day", "diet_kcal_mean_recall", "sleep_weekday_hours",
    "sleep_weekend_hours",
]
FEATURE_SETS = {
    "demographic": DEMOGRAPHIC,
    "demographic_anthropometric": DEMOGRAPHIC + ANTHROPOMETRIC,
    "full_non_laboratory": DEMOGRAPHIC + ANTHROPOMETRIC + BLOOD_PRESSURE + LIFESTYLE,
}
CATEGORICAL = ["sex", "race_ethnicity"]
NUMERIC = [feature for feature in FEATURE_SETS["full_non_laboratory"] if feature not in CATEGORICAL]
TARGETS = {
    "laboratory_undiagnosed": "lab_diabetes",
    "self_reported_diagnosis": "self_reported_diabetes",
}


def read_cohort(name: str) -> pd.DataFrame:
    path = PROCESSED_DIR / f"cohort_{name}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run prepare_cohort.py first.")
    return pd.read_csv(path)


def make_preprocessor(features: list[str], scale_numeric: bool) -> ColumnTransformer:
    categorical = [name for name in features if name in CATEGORICAL]
    numeric = [name for name in features if name not in CATEGORICAL]
    numeric_steps: list[tuple[str, object]] = [("imputer", SimpleImputer(strategy="median", add_indicator=True))]
    if scale_numeric:
        numeric_steps.append(("scaler", StandardScaler()))
    transformers: list[tuple[str, object, list[str]]] = []
    if numeric:
        transformers.append(("numeric", Pipeline(numeric_steps), numeric))
    if categorical:
        transformers.append(("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), categorical))
    return ColumnTransformer(transformers, remainder="drop", verbose_feature_names_out=True)


def weighted_prevalence(frame: pd.DataFrame, target: str, weight: str) -> dict[str, float | int | None]:
    subset = frame[[target, weight]].dropna()
    subset = subset[subset[weight] > 0]
    if subset.empty or subset[target].nunique() < 2:
        return {"n": int(len(subset)), "weighted_prevalence": None}
    prevalence = float(np.average(subset[target].astype(float), weights=subset[weight]))
    return {"n": int(len(subset)), "weighted_prevalence": prevalence}
