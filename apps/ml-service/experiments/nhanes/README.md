# GlycoTwin NHANES Model A feasibility experiment

An isolated, exploratory NHANES 2017–2018 experiment for (1) a lab-defined possible undiagnosed diabetes label among adults who report no prior diabetes diagnosis, and (2) a separate self-reported diagnosed-status label. This is a cross-sectional classification exercise; it does **not** predict future onset, diagnose people or produce calibrated personal risk.

## Data and target rules

The downloader uses only CDC public-use files from the official 2017–2018 release: `DEMO_J`, `DIQ_J`, `BMX_J`, `BPX_J`, `GHB_J`, `GLU_J`, `PAQ_J`, `DR1TOT_J`, `DR2TOT_J`, and `SLQ_J`. Documentation links and variable selection are in `reports/DATASET_AUDIT.md`.

Primary target: among adults `RIDAGEYR >= 20` with `DIQ010=2`, require both HbA1c and fasting glucose observed; positive if `LBXGH >= 6.5` **or** `LBXGLU >= 126 mg/dL`, control if both are observed and below thresholds. `DIQ010=3/7/9` or missing is ambiguous/nonresponse and never negative. Secondary target is `DIQ010=1` versus `2` among adults. These are operational research labels, not clinical diagnoses.

No target lab, DIQ response, medication, `SEQN`, weight, PSU or stratum is a predictor. The full predictor set includes demographic, anthropometric, repeated blood-pressure summary, activity, diet-recall and sleep features. Missing predictors are imputed inside training pipelines; complete-case counts are separately reported. See `reports/LIMITATIONS.md` for selection, survey and uncertainty limits.

## PowerShell workflow

From repository root (`C:\glycotwin`), reusing the existing ML-service environment:

```powershell
Set-Location apps/ml-service
\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python experiments\nhanes\download_data.py
python experiments\nhanes\prepare_cohort.py
python experiments\nhanes\train.py
python experiments\nhanes\evaluate.py
python -m pytest experiments\nhanes\tests
```

The existing parent environment already supplies pandas, NumPy, scikit-learn, XGBoost, matplotlib, joblib and pytest; there are no additional dependencies, so no nested `requirements.txt` is needed. To create a separate environment instead, run `py -m venv .venv-nhanes`, activate it, then install the same `apps/ml-service/requirements.txt`.

All scripts default to paths relative to their own file using `pathlib`; they can also be invoked from the experiment directory with `python download_data.py`, etc. `download_data.py --force` replaces local copies. The data are ignored by Git under `data/raw/` and `data/processed/`; do not commit row-level files or participant identifiers.

## Outputs

- `data/processed/cohort_summary.json`, `cohort_flow.csv`, `feature_missingness.csv`, `descriptive_statistics.csv`, `categorical_distributions.csv`, `feature_correlations.csv`, `missingness_patterns.csv`, `model_comparison.csv`, `subgroup_metrics.csv`.
- `artifacts/training_manifest.json`, fitted pipelines under `artifacts/models/`, and `artifacts/final_metrics.json`.
- `artifacts/confusion_matrix.png`, `roc_curve.png`, `precision_recall_curve.png`, and `feature_importance.png`.
- `artifacts/feature_distributions.png` (unweighted observed-value distributions by primary label).
- `reports/DATASET_AUDIT.md`, `COHORT_FLOW.md`, `MODEL_COMPARISON.md`, and `LIMITATIONS.md`.

The one 75/25 split is stratified and fixed at seed 42. Three models are compared for each target and feature set. Five-fold stratified CV is confined to the training partition and selects the best model by mean ROC-AUC within each feature set. The held-out metrics use fixed threshold 0.5; no threshold tuning uses the test data. Survey-weighted prevalence point estimates are separate from unweighted ML metrics; the latter are not nationally representative.

## Experiment 2 and final decision

Experiment 1 retained 116 primary-target participants without a positive fasting subsample weight in its unweighted model cohort. Experiment 2 audited the NHANES GLU_J fasting-weight eligibility rule, preserved the original split positions, and excluded those 116 participants for its fasting-target analysis (86 training, 30 holdout). Its corrected cohort has 1,823 participants (115 positive), split into 1,368 training participants (88 positive) and 455 holdout participants (27 positive). Experiment 1 outputs remain preserved; see [Experiment 2](experiment_2/UPDATED_MODEL_COMPARISON.md) for threshold, calibration, and robustness analyses.

**Final disposition:** NHANES remains an experimental cross-sectional research baseline. No classifier is approved for user-facing diabetes risk assessment. See [FINAL_DECISION.md](FINAL_DECISION.md) for the combined rationale, results, and limitations.

## Data hygiene and scope

Raw and participant-level processed data stay local and ignored. Only official CDC public-use XPTs are used. No Pima source or production file is changed; NHANES outputs and code are contained in this directory. All model artifacts are exploratory research outputs and are not wired into the FastAPI service.
