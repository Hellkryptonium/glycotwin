from __future__ import annotations

import numpy as np
import pandas as pd

from common import CATEGORICAL, FEATURE_SETS, make_preprocessor
from evaluate import calculate_metrics
from prepare_cohort import MODULE_COLUMNS, clean_sentinels, normalize_xport_missing


def test_predictor_sets_exclude_identifiers_and_target_labs():
    forbidden = {"SEQN", "LBXGH", "LBXGLU", "lab_diabetes", "self_reported_diabetes", "DIQ010"}
    for features in FEATURE_SETS.values():
        assert not (forbidden & set(features))
        assert set(CATEGORICAL).issubset(set(features))
    assert set(MODULE_COLUMNS) == {
        "DEMO_J", "DIQ_J", "BMX_J", "BPX_J", "GHB_J", "GLU_J", "PAQ_J", "DR1TOT_J", "DR2TOT_J", "SLQ_J"
    }


def test_training_preprocessor_handles_missing_training_values():
    features = FEATURE_SETS["demographic_anthropometric"]
    frame = pd.DataFrame({
        "age_years": [25.0, 42.0, np.nan, 60.0],
        "sex": [1.0, 2.0, 1.0, np.nan],
        "race_ethnicity": [3.0, 4.0, np.nan, 3.0],
        "bmi_kg_m2": [22.5, np.nan, 35.1, 28.0],
        "waist_cm": [80.0, 96.0, 110.0, np.nan],
    })
    transformed = make_preprocessor(features, scale_numeric=True).fit_transform(frame)
    assert transformed.shape[0] == len(frame)
    assert np.isfinite(transformed).all()


def test_metrics_include_both_classes_and_fixed_threshold_confusion_matrix():
    observed = calculate_metrics(np.array([0, 0, 1, 1]), np.array([0.1, 0.8, 0.9, 0.2]), threshold=0.5)
    assert observed["n"] == 4
    assert observed["roc_auc"] == 0.75
    assert observed["confusion_matrix_tn_fp_fn_tp"] == [[1, 1], [1, 1]]
    assert observed["threshold"] == 0.5


def test_documented_sas_and_questionnaire_missing_values_are_missing():
    frame = pd.DataFrame({
        "SAS_SPECIAL_MISSING": [5.397605346934028e-79, 0.0],
        "PAQ605": [7.0, 2.0], "PAQ610": [99.0, 3.0], "PAD615": [9999.0, 0.0],
        "SLD012": [77.0, 8.0], "SLD013": [99.0, 7.0],
    })
    frame = normalize_xport_missing(frame)
    cleaned = clean_sentinels(frame)
    assert np.isnan(cleaned.loc[0, "SAS_SPECIAL_MISSING"])
    assert cleaned.loc[1, "SAS_SPECIAL_MISSING"] == 0.0
    assert pd.isna(cleaned.loc[0, "PAQ605"])
    assert pd.isna(cleaned.loc[0, "PAQ610"])
    assert pd.isna(cleaned.loc[0, "PAD615"])
    assert pd.isna(cleaned.loc[0, "SLD012"])
    assert pd.isna(cleaned.loc[0, "SLD013"])
