"""Join NHANES files and create separate undiagnosed-lab and self-report cohorts."""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parent / "artifacts" / ".matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    ARTIFACT_DIR,
    FEATURE_SETS,
    PROCESSED_DIR,
    REPORT_DIR,
    RAW_DIR,
    TARGETS,
    weighted_prevalence,
)


MODULE_COLUMNS = {
    "DEMO_J": ["SEQN", "SDDSRVYR", "RIDSTATR", "RIAGENDR", "RIDAGEYR", "RIDRETH3", "WTINT2YR", "WTMEC2YR", "SDMVSTRA", "SDMVPSU"],
    "DIQ_J": ["SEQN", "DIQ010"],
    "BMX_J": ["SEQN", "BMXBMI", "BMXWAIST"],
    "BPX_J": ["SEQN", "BPXSY1", "BPXSY2", "BPXSY3", "BPXSY4", "BPXDI1", "BPXDI2", "BPXDI3", "BPXDI4"],
    "GHB_J": ["SEQN", "LBXGH"],
    "GLU_J": ["SEQN", "WTSAF2YR", "LBXGLU"],
    "PAQ_J": ["SEQN", "PAQ605", "PAQ610", "PAD615", "PAQ620", "PAQ625", "PAD630", "PAQ635", "PAQ640", "PAD645", "PAQ650", "PAQ655", "PAD660", "PAQ665", "PAQ670", "PAD675", "PAD680"],
    "DR1TOT_J": ["SEQN", "DR1TKCAL"],
    "DR2TOT_J": ["SEQN", "DR2TKCAL"],
    "SLQ_J": ["SEQN", "SLD012", "SLD013"],
}


def load_module(name: str) -> pd.DataFrame:
    path = RAW_DIR / f"{name}.XPT"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run download_data.py first.")
    frame = normalize_xport_missing(pd.read_sas(path, format="xport", encoding="utf-8"))
    missing = set(MODULE_COLUMNS[name]) - set(frame.columns)
    if missing:
        raise ValueError(f"{name} lacks expected fields: {sorted(missing)}")
    frame = frame[MODULE_COLUMNS[name]].copy()
    if frame["SEQN"].duplicated().any():
        raise ValueError(f"{name} contains duplicate SEQN values")
    return frame


def normalize_xport_missing(frame: pd.DataFrame) -> pd.DataFrame:
    """Convert SAS XPORT extended-missing float markers to ordinary NaN."""
    frame = frame.copy()
    # pandas exposes the SAS extended-missing marker present in these XPTs as
    # a finite subnormal float (5.397605346934028e-79), not NaN. No real NHANES
    # measurement in these selected modules is anywhere near this magnitude.
    for field in frame.select_dtypes(include=[np.number]).columns:
        special_missing = frame[field].notna() & frame[field].ne(0) & frame[field].abs().lt(1e-50)
        frame.loc[special_missing, field] = np.nan
    return frame


def clean_sentinels(frame: pd.DataFrame) -> pd.DataFrame:
    """Translate documented refusal/unknown codes to missing for selected fields."""
    out = frame.copy()
    # NHANES questionnaire codes 7/9 and duration/day codes 77/99/7777/9999
    # represent refusal, don't know, or nonresponse for the fields below.
    for field in ["PAQ605", "PAQ620", "PAQ635", "PAQ650", "PAQ665"]:
        if field in out:
            out[field] = out[field].replace({7: np.nan, 9: np.nan})
    for field in ["PAQ610", "PAQ625", "PAQ640", "PAQ655", "PAQ670"]:
        if field in out:
            out[field] = out[field].replace({77: np.nan, 99: np.nan})
    for field in ["PAD615", "PAD630", "PAD645", "PAD660", "PAD675", "PAD680"]:
        if field in out:
            out[field] = out[field].replace({7777: np.nan, 9999: np.nan})
    for field in ["SLD012", "SLD013"]:
        if field in out:
            out[field] = out[field].replace({77: np.nan, 99: np.nan})
    return out


def build_merged() -> tuple[pd.DataFrame, dict[str, int]]:
    counts: dict[str, int] = {}
    frames = {}
    for name in MODULE_COLUMNS:
        frames[name] = load_module(name)
        counts[f"rows_{name}"] = int(len(frames[name]))
    merged = frames["DEMO_J"]
    for name in list(MODULE_COLUMNS)[1:]:
        merged = merged.merge(frames[name], on="SEQN", how="left", validate="one_to_one")
    counts["merged_unique_participants"] = int(merged["SEQN"].nunique())

    # Average each blood-pressure component across all available valid readings.
    for prefix, output in [("BPXSY", "systolic_mean_mmhg"), ("BPXDI", "diastolic_mean_mmhg")]:
        fields = [f"{prefix}{i}" for i in range(1, 5)]
        readings = merged[fields].replace(0, np.nan)
        merged[output] = readings.mean(axis=1, skipna=True)

    merged = clean_sentinels(merged)
    merged["age_years"] = merged["RIDAGEYR"]
    merged["sex"] = merged["RIAGENDR"]
    merged["race_ethnicity"] = merged["RIDRETH3"]
    merged["bmi_kg_m2"] = merged["BMXBMI"]
    merged["waist_cm"] = merged["BMXWAIST"]

    activity_pairs = [
        ("PAQ605", "PAQ610", "PAD615", "vigorous_work_days", "vigorous_work_min_day"),
        ("PAQ620", "PAQ625", "PAD630", "moderate_work_days", "moderate_work_min_day"),
        ("PAQ635", "PAQ640", "PAD645", "walk_bicycle_days", "walk_bicycle_min_day"),
        ("PAQ650", "PAQ655", "PAD660", "vigorous_recreation_days", "vigorous_recreation_min_day"),
        ("PAQ665", "PAQ670", "PAD675", "moderate_recreation_days", "moderate_recreation_min_day"),
    ]
    for yes_no, days, duration, out_days, out_duration in activity_pairs:
        inactive = merged[yes_no].eq(2)
        merged[out_days] = merged[days].where(~inactive, 0)
        merged[out_duration] = merged[duration].where(~inactive, 0)
    merged["sedentary_min_day"] = merged["PAD680"]
    merged["diet_kcal_mean_recall"] = merged[["DR1TKCAL", "DR2TKCAL"]].mean(axis=1, skipna=True)
    merged["sleep_weekday_hours"] = merged["SLD012"]
    merged["sleep_weekend_hours"] = merged["SLD013"]

    merged["adult_20plus"] = merged["RIDAGEYR"].ge(20)
    merged["self_reported_diabetes"] = merged["DIQ010"].map({1: 1, 2: 0}).astype("float")
    lab_complete = merged["LBXGH"].notna() & merged["LBXGLU"].notna()
    merged["lab_diabetes"] = np.where(
        lab_complete,
        ((merged["LBXGH"] >= 6.5) | (merged["LBXGLU"] >= 126)).astype(float),
        np.nan,
    )

    adults = merged[merged["adult_20plus"]].copy()
    diagnosis_valid = adults["DIQ010"].isin([1, 2])
    primary_mask = adults["DIQ010"].eq(2) & lab_complete.loc[adults.index]
    primary = adults[primary_mask].copy()
    secondary = adults[diagnosis_valid].copy()

    counts.update({
        "raw_merged_participants": int(len(merged)),
        "adults_20plus": int(len(adults)),
        "adult_diagnosis_yes": int(adults["DIQ010"].eq(1).sum()),
        "adult_diagnosis_no": int(adults["DIQ010"].eq(2).sum()),
        "adult_diagnosis_ambiguous_or_missing": int((~diagnosis_valid).sum()),
        "adult_no_prior_diagnosis_missing_one_or_both_labs": int((adults["DIQ010"].eq(2) & ~lab_complete.loc[adults.index]).sum()),
        "adult_no_prior_diagnosis_missing_hba1c": int((adults["DIQ010"].eq(2) & adults["LBXGH"].isna()).sum()),
        "adult_no_prior_diagnosis_missing_fasting_glucose": int((adults["DIQ010"].eq(2) & adults["LBXGLU"].isna()).sum()),
        "adult_no_prior_diagnosis_missing_both_labs": int((adults["DIQ010"].eq(2) & adults["LBXGH"].isna() & adults["LBXGLU"].isna()).sum()),
        "primary_lab_eligible": int(len(primary)),
        "primary_lab_eligible_missing_fast_subsample_weight": int(primary["WTSAF2YR"].isna().sum()),
        "primary_lab_cases": int(primary["lab_diabetes"].eq(1).sum()),
        "primary_lab_controls": int(primary["lab_diabetes"].eq(0).sum()),
        "secondary_self_report_eligible": int(len(secondary)),
        "secondary_self_report_cases": int(secondary["self_reported_diabetes"].eq(1).sum()),
        "secondary_self_report_controls": int(secondary["self_reported_diabetes"].eq(0).sum()),
    })
    return merged, {**counts, "_primary": primary, "_secondary": secondary}  # type: ignore[return-value]


def weighted_prevalences(primary: pd.DataFrame, secondary: pd.DataFrame) -> dict[str, object]:
    return {
        "laboratory_undiagnosed_fast_subsample": weighted_prevalence(primary, "lab_diabetes", "WTSAF2YR"),
        "self_reported_adult_interview": weighted_prevalence(secondary, "self_reported_diabetes", "WTINT2YR"),
        "notes": "Weighted point estimates only; no Taylor-linearized standard errors/CI are calculated in this exploratory pipeline.",
    }


def quality_outputs(cohorts: dict[str, pd.DataFrame]) -> None:
    missing_rows = []
    descriptive_rows = []
    category_rows = []
    correlation_rows = []
    pattern_rows = []
    for cohort_name, frame in cohorts.items():
        target = TARGETS[cohort_name]
        for feature_set, features in FEATURE_SETS.items():
            complete = int(frame[features].notna().all(axis=1).sum())
            for feature in features:
                missing = int(frame[feature].isna().sum())
                missing_rows.append({
                    "cohort": cohort_name, "feature_set": feature_set, "feature": feature,
                    "eligible_n": len(frame), "missing_n": missing,
                    "missing_percent": 100.0 * missing / len(frame) if len(frame) else np.nan,
                    "observed_n": len(frame) - missing, "complete_case_n_for_feature_set": complete,
                })
        numeric_features = [feature for feature in FEATURE_SETS["full_non_laboratory"] if feature not in ["sex", "race_ethnicity"]]
        for label, group in frame.groupby(target, dropna=False):
            for feature in numeric_features:
                series = group[feature].dropna()
                descriptive_rows.append({
                    "cohort": cohort_name, "target": target, "class": int(label), "feature": feature,
                    "n_nonmissing": int(series.size), "mean": series.mean(), "std": series.std(),
                    "min": series.min(), "q25": series.quantile(.25), "median": series.median(),
                    "q75": series.quantile(.75), "max": series.max(),
                })
        for feature in ["sex", "race_ethnicity"]:
            counts = frame.groupby([target, feature], dropna=False).size().reset_index(name="n")
            for _, row in counts.iterrows():
                category_rows.append({"cohort": cohort_name, "target": target, "class": row[target], "feature": feature, "category": row[feature], "n": int(row["n"])})
        corr_data = frame[numeric_features + [target]].corr(method="spearman", min_periods=20)
        for left in corr_data.columns:
            for right in corr_data.columns:
                if left < right:
                    correlation_rows.append({"cohort": cohort_name, "method": "spearman_pairwise", "feature_1": left, "feature_2": right, "correlation": corr_data.loc[left, right]})
        full_features = FEATURE_SETS["full_non_laboratory"]
        patterns = frame[full_features].isna().astype(int).astype(str).agg("".join, axis=1).value_counts().head(30)
        for mask, n in patterns.items():
            pattern_rows.append({"cohort": cohort_name, "missingness_mask_feature_order": ",".join(full_features), "pattern": mask, "n": int(n), "percent": 100.0 * n / len(frame)})
    pd.DataFrame(missing_rows).to_csv(PROCESSED_DIR / "feature_missingness.csv", index=False)
    pd.DataFrame(descriptive_rows).to_csv(PROCESSED_DIR / "descriptive_statistics.csv", index=False)
    pd.DataFrame(category_rows).to_csv(PROCESSED_DIR / "categorical_distributions.csv", index=False)
    pd.DataFrame(correlation_rows).to_csv(PROCESSED_DIR / "feature_correlations.csv", index=False)
    pd.DataFrame(pattern_rows).to_csv(PROCESSED_DIR / "missingness_patterns.csv", index=False)
    plot_feature_distributions(cohorts["laboratory_undiagnosed"])


def plot_feature_distributions(frame: pd.DataFrame) -> None:
    features = [name for name in FEATURE_SETS["full_non_laboratory"] if name not in ["sex", "race_ethnicity"]]
    ncols = 3
    nrows = int(np.ceil(len(features) / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(15, 4 * nrows))
    for ax, feature in zip(axes.flat, features):
        for target_value, label, color in [(0, "Below lab cutpoints", "#2878b5"), (1, "Meets lab cutpoint", "#d65f5f")]:
            values = frame.loc[frame["lab_diabetes"].eq(target_value), feature].dropna()
            if not values.empty:
                ax.hist(values, bins=20, density=True, alpha=.45, label=label, color=color)
        ax.set_title(feature.replace("_", " "))
        ax.set_ylabel("Density")
        ax.legend(fontsize=7)
    for ax in axes.flat[len(features):]:
        ax.set_visible(False)
    fig.suptitle("Primary target predictor distributions (unweighted; observed values only)", y=1.005)
    fig.tight_layout()
    fig.savefig(ARTIFACT_DIR / "feature_distributions.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    merged, counts_with_frames = build_merged()
    primary = counts_with_frames.pop("_primary")
    secondary = counts_with_frames.pop("_secondary")
    cohorts = {"laboratory_undiagnosed": primary, "self_reported_diagnosis": secondary}
    keep = ["SEQN", "WTSAF2YR", "WTMEC2YR", "WTINT2YR", "WTDRD1", "WTDR2D", "SDMVSTRA", "SDMVPSU", "DIQ010", "LBXGH", "LBXGLU", "lab_diabetes", "self_reported_diabetes"] + FEATURE_SETS["full_non_laboratory"]
    for name, frame in cohorts.items():
        present = [column for column in keep if column in frame.columns]
        frame[present].to_csv(PROCESSED_DIR / f"cohort_{name}.csv", index=False)
    prevalences = weighted_prevalences(primary, secondary)
    summary = {"cycle": "NHANES 2017-2018", "age_minimum": 20, "seed": 42, "flow_counts": counts_with_frames, "weighted_prevalence": prevalences}
    (PROCESSED_DIR / "cohort_summary.json").write_text(json.dumps(summary, indent=2, allow_nan=False), encoding="utf-8")
    flow = [
        {"flow": "all merged participants", "n": counts_with_frames["raw_merged_participants"], "details": "Unique SEQN after validated left joins"},
        {"flow": "adults age 20+", "n": counts_with_frames["adults_20plus"], "details": "RIDAGEYR >= 20"},
        {"flow": "adults with DIQ010 yes", "n": counts_with_frames["adult_diagnosis_yes"], "details": "Previously diagnosed; excluded from primary undiagnosed cohort"},
        {"flow": "adults with DIQ010 no", "n": counts_with_frames["adult_diagnosis_no"], "details": "Eligible diagnosis response"},
        {"flow": "adults with ambiguous or missing DIQ010", "n": counts_with_frames["adult_diagnosis_ambiguous_or_missing"], "details": "Excluded from both target cohorts; never recoded as negative"},
        {"flow": "DIQ010 no but one or both labs missing", "n": counts_with_frames["adult_no_prior_diagnosis_missing_one_or_both_labs"], "details": "Excluded from primary lab composite; see module-specific missingness"},
        {"flow": "DIQ010 no, missing HbA1c", "n": counts_with_frames["adult_no_prior_diagnosis_missing_hba1c"], "details": "Can overlap the fasting-glucose missing count"},
        {"flow": "DIQ010 no, missing fasting glucose", "n": counts_with_frames["adult_no_prior_diagnosis_missing_fasting_glucose"], "details": "Fasting subsample; can overlap HbA1c missing count"},
        {"flow": "DIQ010 no, both labs missing", "n": counts_with_frames["adult_no_prior_diagnosis_missing_both_labs"], "details": "Subset of either-lab-missing exclusions"},
        {"flow": "primary complete-lab eligible", "n": counts_with_frames["primary_lab_eligible"], "details": "DIQ010=2 and both LBXGH and LBXGLU observed"},
        {"flow": "primary lab eligible without WTSAF2YR", "n": counts_with_frames["primary_lab_eligible_missing_fast_subsample_weight"], "details": "Retained for unweighted model analysis; excluded from weighted prevalence denominator"},
        {"flow": "primary lab cases", "n": counts_with_frames["primary_lab_cases"], "details": "LBXGH >= 6.5 OR LBXGLU >= 126"},
        {"flow": "primary lab controls", "n": counts_with_frames["primary_lab_controls"], "details": "Both labs observed and both below thresholds"},
        {"flow": "secondary self-report eligible", "n": counts_with_frames["secondary_self_report_eligible"], "details": "DIQ010 in {1,2}; adults only"},
        {"flow": "secondary self-report cases", "n": counts_with_frames["secondary_self_report_cases"], "details": "DIQ010=1"},
        {"flow": "secondary self-report controls", "n": counts_with_frames["secondary_self_report_controls"], "details": "DIQ010=2"},
    ]
    pd.DataFrame(flow).to_csv(PROCESSED_DIR / "cohort_flow.csv", index=False)
    (PROCESSED_DIR / "cohort_flow.json").write_text(json.dumps(flow, indent=2), encoding="utf-8")
    quality_outputs(cohorts)
    (REPORT_DIR / "DATASET_AUDIT.md").write_text(dataset_audit(summary), encoding="utf-8")
    (REPORT_DIR / "COHORT_FLOW.md").write_text(cohort_flow_report(summary, flow), encoding="utf-8")
    print(json.dumps(summary, indent=2))


def dataset_audit(summary: dict[str, object]) -> str:
    counts = summary["flow_counts"]
    return f"""# NHANES 2017–2018 dataset audit

## Source and join

Downloaded official CDC public-use XPT files: DEMO_J, DIQ_J, BMX_J, BPX_J, GHB_J, GLU_J, PAQ_J, DR1TOT_J, DR2TOT_J and SLQ_J. `SEQN` is used only for one-to-one joins and audit; it is never a predictor. The merge is left anchored on DEMO_J so module nonparticipation remains visible as missing values. Unique row counts are available in `../data/processed/cohort_summary.json`.

Official documentation: [2017–2018 NHANES portal](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?BeginYear=2017), [DEMO_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/DEMO_J.htm), [DIQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/DIQ_J.htm), [BMX_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/BMX_J.htm), [BPX_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/BPX_J.htm), [GHB_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/GHB_J.htm), [GLU_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/GLU_J.htm), [PAQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/PAQ_J.htm), [DR1TOT_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/DR1TOT_J.htm), [DR2TOT_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/DR2TOT_J.htm), [SLQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/SLQ_J.htm).

## Targets and eligibility

- Adults have `RIDAGEYR >= 20` (age 80 is top-coded in public NHANES).
- Primary target is a research-only laboratory definition among adults answering `DIQ010=2` (not previously told they have diabetes): positive when `LBXGH >= 6.5%` OR `LBXGLU >= 126 mg/dL`; requires both labs observed so a negative means both measured results are below threshold. `WTSAF2YR` is used for the weighted point estimate because the fasting subsample restricts eligibility.
- Requiring both tests means a participant with an elevated HbA1c but no fasting glucose is excluded, as is a participant with elevated fasting glucose but no HbA1c. This complete-lab rule improves control-label certainty but narrows and changes the available cohort; the flow reports each missing-test count and the 116 eligible records without a usable fasting weight.
- Secondary target is `DIQ010=1` versus `DIQ010=2` among adults with those two unambiguous answers. Codes 3 (borderline), 7 (refused), 9 (don't know) and missing are excluded, never treated as negative.
- The two NHANES thresholds are operational research cut points applied to one survey collection, not a diagnosis or a future-onset outcome. The OR rule marks a positive if either marker is elevated; requiring both results observed is conservative for defining controls and narrows the cohort.

## Features

- Demographic: `RIDAGEYR`, `RIAGENDR`, `RIDRETH3`.
- `RIDRETH3` codes are 1 Mexican American, 2 Other Hispanic, 3 Non-Hispanic White, 4 Non-Hispanic Black, 6 Non-Hispanic Asian, and 7 Other race including multiracial; treat them as categories, not an ordered scale.
- Anthropometric: `BMXBMI`, `BMXWAIST`.
- Blood pressure: mean of all available valid readings among `BPXSY1–4` and `BPXDI1–4`; zero is treated as invalid for BP. Read count is not a predictor.
- Lifestyle: PAQ work, transport and recreation frequency/duration, sedentary time; average available day-1/day-2 total energy recall; weekday/weekend sleep duration (`SLD012`, `SLD013`). Activity “no” responses map structurally skipped days/durations to zero; refused/don't-know codes are missing. Diet recalls are short-term self-reports, not habitual intake.
- HbA1c, fasting glucose, diabetes medication, DIQ answers, SEQN, survey weights, PSU and strata are not predictors. Target labs remain only for target definition/audit.

## Survey weights and validation

Preserve `SDMVSTRA` and `SDMVPSU`. Use `WTSAF2YR` for a fasting-glucose analysis; `WTMEC2YR` for exam data, `WTINT2YR` for interview-only estimates, and dietary recall weights (`WTDRD1`/`WTDR2D`) for day-specific dietary estimates. The weighted prevalence values in the summary are point estimates only; this experiment does not compute design-based standard errors. ML train/test metrics are unweighted exploratory holdout metrics and must not be called nationally representative. Random stratified splitting also does not account for NHANES survey design; design-aware model validation remains future work.

Pandas reads the finite subnormal `5.397605346934028e-79` in these XPTs as an extended SAS missing value; the loader converts that marker to NaN before merging. Genuine zero values are preserved except zero blood-pressure readings, which are invalid. Primary participants missing `WTSAF2YR` remain eligible for the unweighted model but are omitted from the weighted prevalence denominator.

## Generated quality outputs

`feature_missingness.csv`, `descriptive_statistics.csv`, `categorical_distributions.csv`, `feature_correlations.csv` and `missingness_patterns.csv` report the observed-data quality. Models impute predictors inside training pipelines, so feature missingness does not silently delete otherwise target-eligible participants. Complete-case counts by feature set are recorded as selection diagnostics.

`artifacts/feature_distributions.png` shows unweighted observed-value histograms by primary label; it is descriptive and does not reflect NHANES sampling weights.
"""


def cohort_flow_report(summary: dict[str, object], flow: list[dict[str, object]]) -> str:
    table = "\n".join(f"| {row['flow']} | {row['n']:,} | {row['details']} |" for row in flow)
    prevalence = summary["weighted_prevalence"]
    return f"""# Cohort flow

The complete flow and module counts are in `../data/processed/cohort_flow.csv` and `cohort_summary.json`. Age restriction and target-specific eligibility are applied before feature imputation; missing predictors are retained and imputed within each training fold.

| Stage | N | Details |
|---|---:|---|
{table}

## Survey-weighted point estimates

- Lab-defined primary target among complete-lab, non-diagnosed adults: {prevalence['laboratory_undiagnosed_fast_subsample']['weighted_prevalence']!r} using `WTSAF2YR` (N={prevalence['laboratory_undiagnosed_fast_subsample']['n']:,}).
- Self-reported diagnosis among adults with DIQ010 yes/no: {prevalence['self_reported_adult_interview']['weighted_prevalence']!r} using `WTINT2YR` (N={prevalence['self_reported_adult_interview']['n']:,}).

These are weighted point estimates without design-based confidence intervals. Model metrics below are unweighted.
"""


if __name__ == "__main__":
    main()
