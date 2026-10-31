# NHANES Model A model comparison

Metrics are unweighted, from the fixed stratified 25% holdout, and use threshold 0.5. Training-only stratified cross-validation selected the displayed primary model; the test set did not select the model or threshold. Full candidate metrics are in `../artifacts/final_metrics.json` and `../data/processed/model_comparison.csv`.

| Target | Feature set | Model | Test N | ROC-AUC | Average precision | Sensitivity | Specificity | Precision | F1 | Balanced accuracy |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| laboratory_undiagnosed | demographic | logistic_regression | 485 | 0.693 | 0.116 | 0.656 | 0.623 | 0.109 | 0.188 | 0.639 |
| laboratory_undiagnosed | demographic | random_forest | 485 | 0.686 | 0.113 | 0.219 | 0.850 | 0.093 | 0.131 | 0.534 |
| laboratory_undiagnosed | demographic | xgboost | 485 | 0.687 | 0.230 | 0.000 | 1.000 | 0.000 | 0.000 | 0.500 |
| laboratory_undiagnosed | demographic_anthropometric | logistic_regression | 485 | 0.771 | 0.144 | 0.750 | 0.678 | 0.141 | 0.238 | 0.714 |
| laboratory_undiagnosed | demographic_anthropometric | random_forest | 485 | 0.711 | 0.143 | 0.031 | 0.978 | 0.091 | 0.047 | 0.505 |
| laboratory_undiagnosed | demographic_anthropometric | xgboost | 485 | 0.750 | 0.158 | 0.000 | 1.000 | 0.000 | 0.000 | 0.500 |
| laboratory_undiagnosed | full_non_laboratory | logistic_regression | 485 | 0.720 | 0.136 | 0.750 | 0.671 | 0.139 | 0.234 | 0.711 |
| laboratory_undiagnosed | full_non_laboratory | random_forest | 485 | 0.812 | 0.184 | 0.031 | 0.991 | 0.200 | 0.054 | 0.511 |
| laboratory_undiagnosed | full_non_laboratory | xgboost | 485 | 0.799 | 0.173 | 0.000 | 1.000 | 0.000 | 0.000 | 0.500 |
| self_reported_diagnosis | demographic | logistic_regression | 1349 | 0.767 | 0.331 | 0.753 | 0.651 | 0.295 | 0.424 | 0.702 |
| self_reported_diagnosis | demographic | random_forest | 1349 | 0.702 | 0.262 | 0.603 | 0.687 | 0.272 | 0.374 | 0.645 |
| self_reported_diagnosis | demographic | xgboost | 1349 | 0.768 | 0.339 | 0.005 | 0.999 | 0.500 | 0.009 | 0.502 |
| self_reported_diagnosis | demographic_anthropometric | logistic_regression | 1349 | 0.802 | 0.416 | 0.799 | 0.685 | 0.330 | 0.467 | 0.742 |
| self_reported_diagnosis | demographic_anthropometric | random_forest | 1349 | 0.764 | 0.327 | 0.470 | 0.826 | 0.343 | 0.397 | 0.648 |
| self_reported_diagnosis | demographic_anthropometric | xgboost | 1349 | 0.798 | 0.392 | 0.050 | 0.988 | 0.458 | 0.091 | 0.519 |
| self_reported_diagnosis | full_non_laboratory | logistic_regression | 1349 | 0.813 | 0.425 | 0.808 | 0.691 | 0.337 | 0.475 | 0.750 |
| self_reported_diagnosis | full_non_laboratory | random_forest | 1349 | 0.805 | 0.438 | 0.320 | 0.922 | 0.443 | 0.371 | 0.621 |
| self_reported_diagnosis | full_non_laboratory | xgboost | 1349 | 0.810 | 0.443 | 0.087 | 0.989 | 0.613 | 0.152 | 0.538 |

All three feature sets use the same outcome-eligible participants after training-only imputation. Complete-case counts below show the sample loss that a complete-case analysis would incur; they are not the model sample sizes.

| Feature set | Eligible N | Complete-case N | Complete-case exclusions |
|---|---:|---:|---:|
| demographic | 1939 | 1939 | 0 |
| demographic_anthropometric | 1939 | 1839 | 100 |
| full_non_laboratory | 1939 | 1648 | 291 |

## Primary model selected from training CV

- Cohort: `laboratory_undiagnosed`; feature set: `full_non_laboratory`; selected model: **xgboost**.
- Test metrics: ROC-AUC 0.799, average precision 0.173, sensitivity 0.000, specificity 1.000, precision 0.000, F1 0.000, balanced accuracy 0.500.
- Confusion matrix (actual rows: negative/positive; predicted columns: negative/positive): `[[453, 0], [32, 0]]`.
- Ordinary participant-level bootstrap 95% percentile intervals are in `final_metrics.json`; they do not account for NHANES strata, PSU or weights.

## Holdout trade-offs inside the full feature set

The random forest had the largest observed holdout ROC-AUC (0.812) and average precision (0.184) among the full-feature candidates, but at the fixed 0.5 cutoff it identified only 1 of 32 lab-positive participants (sensitivity 0.031). Logistic regression identified 24 of 32 (sensitivity 0.750) with specificity 0.671, but lower ROC-AUC (0.720). XGBoost was selected by training-only CV and predicted every holdout record negative at 0.5. These differences show why ranking by AUC alone does not select an operating point; the test results are descriptive and were not used to change the model or threshold.

## Test-set subgroup check

| Dimension | Group | Test N | Positive N | Negative N | Result |
|---|---|---:|---:|---:|---|
| sex | Male | 224 | 19 | 205 | suppressed: <20 cases or <20 controls |
| sex | Female | 261 | 13 | 248 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Mexican American | 69 | 2 | 67 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Other Hispanic | 50 | 6 | 44 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Non-Hispanic White | 149 | 5 | 144 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Non-Hispanic Black | 121 | 12 | 109 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Non-Hispanic Asian | 66 | 6 | 60 | suppressed: <20 cases or <20 controls |
| race_ethnicity | Other race/multiracial | 30 | 1 | 29 | suppressed: <20 cases or <20 controls |

Sensitivity/specificity and other subgroup metrics are suppressed unless both classes have at least 20 test participants. No demographic subgroup meets this rule in the primary test split, so this experiment supports no fairness conclusion.

## Comparison with the existing Pima experiment

The existing Pima artifact has 768 curated records and its fixed holdout ROC-AUC was 0.813, sensitivity 0.704, specificity 0.750, and precision 0.603. That is not a head-to-head benchmark: Pima has a different historical outcome, population, feature set and split; NHANES here is a cross-sectional lab-defined current-status task among adults without reported prior diagnosis. The metrics must not be ranked as if labels were interchangeable.

## Interpretation

All probabilities are model scores, not calibrated personal diabetes risk. The test set is modest and the data are a complex survey; point metrics and ordinary bootstrap intervals are uncertain. The best CV model is a development choice only. A national performance claim would require design-aware validation and an appropriate survey evaluation procedure.
