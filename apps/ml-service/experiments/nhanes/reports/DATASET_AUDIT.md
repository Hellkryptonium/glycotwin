# NHANES 2017–2018 dataset audit

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
