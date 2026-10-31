# Experiment 2 — robustness and methodology audit

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
| exp1_logistic_balanced | 25 | 0.700 | 0.069 | 0.541–0.833 | 0.152 ± 0.044 | 0.205 ± 0.010 |
| exp1_random_forest_balanced_subsample | 25 | 0.705 | 0.060 | 0.570–0.859 | 0.158 ± 0.049 | 0.067 ± 0.004 |
| exp1_xgboost_unweighted | 25 | 0.697 | 0.065 | 0.497–0.825 | 0.152 ± 0.031 | 0.060 ± 0.002 |
| xgboost_scale_pos_weight | 25 | 0.691 | 0.075 | 0.469–0.874 | 0.157 ± 0.072 | 0.137 ± 0.009 |

The repeated design is five repetitions of stratified five-fold CV, all within the valid-weight training cohort. Fold metrics are descriptive, correlated across repeats, and their SD is variation rather than an inferential confidence interval. Thresholds use the mean of five OOF probabilities per training participant. No oversampling or SMOTE was used. LR is inverse-frequency class-weighted; RF uses `balanced_subsample`; the added XGBoost derives `scale_pos_weight = negatives / positives` within every individual model fit, never from validation or holdout labels. This follows the [XGBoost parameter guidance](https://xgboost.readthedocs.io/en/latest/parameter.html); RF weighting follows [scikit-learn class_weight semantics](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html).

## Holdout uncertainty and subgroups

Holdout sensitivity is based on only 27 positive cases. Each additional true positive changes sensitivity by about 3.7 percentage points. Stratified participant bootstrap intervals preserve the observed class counts and quantify conditional sampling variability; they do not account for NHANES strata, PSU or weights.

| Model/threshold rule | Sensitivity 95% CI | Specificity 95% CI | Precision 95% CI | ROC-AUC 95% CI | AP 95% CI |
|---|---:|---:|---:|---:|---:|
| exp1_logistic_balanced__youden_j | 0.556–0.889 | 0.579–0.673 | 0.085–0.134 | 0.624–0.805 | 0.090–0.178 |
| exp1_logistic_balanced__f1_optimized | 0.185–0.556 | 0.790–0.862 | 0.067–0.176 | 0.624–0.805 | 0.090–0.178 |
| exp1_logistic_balanced__sensitivity_80 | 0.741–1.000 | 0.435–0.528 | 0.083–0.112 | 0.624–0.805 | 0.090–0.178 |
| exp1_logistic_balanced__fixed_0_5 | 0.444–0.815 | 0.619–0.713 | 0.076–0.134 | 0.624–0.805 | 0.090–0.178 |
| exp1_random_forest_balanced_subsample__youden_j | 0.519–0.889 | 0.680–0.764 | 0.104–0.174 | 0.728–0.864 | 0.128–0.303 |
| exp1_random_forest_balanced_subsample__f1_optimized | 0.148–0.481 | 0.867–0.925 | 0.077–0.245 | 0.728–0.864 | 0.128–0.303 |
| exp1_random_forest_balanced_subsample__sensitivity_80 | 0.889–1.000 | 0.255–0.339 | 0.072–0.086 | 0.728–0.864 | 0.128–0.303 |
| exp1_random_forest_balanced_subsample__fixed_0_5 | 0.000–0.000 | 0.979–0.998 | 0.000–0.000 | 0.728–0.864 | 0.128–0.303 |
| exp1_xgboost_unweighted__youden_j | 0.667–0.963 | 0.591–0.682 | 0.100–0.148 | 0.693–0.852 | 0.118–0.267 |
| exp1_xgboost_unweighted__f1_optimized | 0.370–0.741 | 0.794–0.864 | 0.118–0.230 | 0.693–0.852 | 0.118–0.267 |
| exp1_xgboost_unweighted__fixed_0_5 | 0.000–0.000 | 1.000–1.000 | 0.000–0.000 | 0.693–0.852 | 0.118–0.267 |
| xgboost_scale_pos_weight__youden_j | 0.667–0.926 | 0.523–0.619 | 0.087–0.128 | 0.668–0.829 | 0.108–0.264 |
| xgboost_scale_pos_weight__f1_optimized | 0.259–0.630 | 0.820–0.886 | 0.097–0.230 | 0.668–0.829 | 0.108–0.264 |
| xgboost_scale_pos_weight__sensitivity_80 | 0.815–1.000 | 0.390–0.488 | 0.082–0.106 | 0.668–0.829 | 0.108–0.264 |
| xgboost_scale_pos_weight__fixed_0_5 | 0.259–0.630 | 0.769–0.843 | 0.077–0.182 | 0.668–0.829 | 0.108–0.264 |

All intervals are in `holdout_bootstrap_cis.json` and are conditional on the fixed threshold and observed case/control counts.

Subgroup counts are from the same holdout. At each model's OOF-Youden threshold, the CSV includes sensitivity/specificity and Wilson 95% intervals. These cells are small; intervals are wide and subgroup differences are not evidence of fairness or unfairness.

| Dimension | Group | N | Positive | Negative |
|---|---|---:|---:|---:|
| age_group | 20-39 | 170 | 3 | 167 |
| age_group | 40-59 | 159 | 10 | 149 |
| age_group | 60+ | 126 | 14 | 112 |
| sex | Male | 209 | 16 | 193 |
| sex | Female | 246 | 11 | 235 |
| race_ethnicity | Mexican American | 68 | 2 | 66 |
| race_ethnicity | Other Hispanic | 47 | 6 | 41 |
| race_ethnicity | Non-Hispanic White | 144 | 4 | 140 |
| race_ethnicity | Non-Hispanic Black | 104 | 9 | 95 |
| race_ethnicity | Non-Hispanic Asian | 62 | 5 | 57 |
| race_ethnicity | Other race/multiracial | 30 | 1 | 29 |

No threshold or calibrator used holdout labels. The holdout is evaluated once for selected train-only thresholds and sigmoid calibration; resulting uncertainty is substantial. Model scores are not calibrated individual risk and the classification target is cross-sectional.
