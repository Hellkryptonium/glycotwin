# Experiment 2 — updated model comparison

Experiment 2 corrects the target-analysis cohort to participants with a positive fasting subsample weight, while preserving the original Experiment 1 split indices. The threshold/model comparisons use full non-laboratory features and common participants: 1,368 training (88 positive) and 455 holdout (27 positive). All imputation/scaling is fold-local. Candidate names distinguish configurations; no candidate is promoted based on test performance.

| Candidate | Threshold | Test N | Positive N | ROC-AUC | AP | Sensitivity | Specificity | Precision | F1 | Balanced accuracy | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exp1_logistic_balanced | youden_j | 0.45 | 455 | 27 | 0.721 | 0.118 | 0.741 | 0.624 | 0.110 | 0.192 | 0.682 | 161 | 7 |
| exp1_logistic_balanced | f1_optimized | 0.65 | 455 | 27 | 0.721 | 0.118 | 0.370 | 0.827 | 0.119 | 0.180 | 0.599 | 74 | 17 |
| exp1_logistic_balanced | sensitivity_80 | 0.30 | 455 | 27 | 0.721 | 0.118 | 0.889 | 0.481 | 0.098 | 0.176 | 0.685 | 222 | 3 |
| exp1_logistic_balanced | fixed_0_5 | 0.50 | 455 | 27 | 0.721 | 0.118 | 0.630 | 0.666 | 0.106 | 0.182 | 0.648 | 143 | 10 |
| exp1_random_forest_balanced_subsample | youden_j | 0.15 | 455 | 27 | 0.799 | 0.178 | 0.704 | 0.722 | 0.138 | 0.230 | 0.713 | 119 | 8 |
| exp1_random_forest_balanced_subsample | f1_optimized | 0.25 | 455 | 27 | 0.799 | 0.178 | 0.296 | 0.897 | 0.154 | 0.203 | 0.597 | 44 | 19 |
| exp1_random_forest_balanced_subsample | sensitivity_80 | 0.05 | 455 | 27 | 0.799 | 0.178 | 0.963 | 0.297 | 0.080 | 0.147 | 0.630 | 301 | 1 |
| exp1_random_forest_balanced_subsample | fixed_0_5 | 0.50 | 455 | 27 | 0.799 | 0.178 | 0.000 | 0.991 | 0.000 | 0.000 | 0.495 | 4 | 27 |
| exp1_xgboost_unweighted | youden_j | 0.05 | 455 | 27 | 0.779 | 0.160 | 0.815 | 0.638 | 0.124 | 0.216 | 0.726 | 155 | 5 |
| exp1_xgboost_unweighted | f1_optimized | 0.10 | 455 | 27 | 0.779 | 0.160 | 0.556 | 0.829 | 0.170 | 0.261 | 0.692 | 73 | 12 |
| exp1_xgboost_unweighted | fixed_0_5 | 0.50 | 455 | 27 | 0.779 | 0.160 | 0.000 | 1.000 | 0.000 | 0.000 | 0.500 | 0 | 27 |
| xgboost_scale_pos_weight | youden_j | 0.25 | 455 | 27 | 0.754 | 0.152 | 0.815 | 0.572 | 0.107 | 0.190 | 0.694 | 183 | 5 |
| xgboost_scale_pos_weight | f1_optimized | 0.55 | 455 | 27 | 0.754 | 0.152 | 0.444 | 0.855 | 0.162 | 0.238 | 0.650 | 62 | 15 |
| xgboost_scale_pos_weight | sensitivity_80 | 0.15 | 455 | 27 | 0.754 | 0.152 | 0.926 | 0.439 | 0.094 | 0.171 | 0.683 | 240 | 2 |
| xgboost_scale_pos_weight | fixed_0_5 | 0.50 | 455 | 27 | 0.754 | 0.152 | 0.444 | 0.808 | 0.128 | 0.198 | 0.626 | 82 | 15 |

Original frozen Experiment 1 selected XGBoost, threshold 0.50, on the valid-weight subset: N=455, positives=27, AUC=0.802, sensitivity=0.000, specificity=1.000. It was trained on all original training rows, including participants now excluded for fasting-weight eligibility, and is included only as a preserved reference.

## Decision

**No candidate is sufficiently useful to retain as an experimental operating-point classifier for possible undiagnosed diabetes at this point.** Random Forest has the strongest corrected-holdout ranking metrics (ROC-AUC 0.799; average precision 0.178), but its training-OOF Youden threshold produced 70.4% sensitivity, 72.2% specificity and 13.8% precision (19 true positives, 119 false positives, 8 false negatives). Its training-OOF threshold chosen for at least 80% sensitivity produced 96.3% sensitivity but only 29.7% specificity and 8.0% precision (301 false positives, 1 false negative). With only 27 holdout cases and wide uncertainty, these results do not establish a useful operating point. The models may remain as research comparators; no model is promoted as a classifier, screening tool, or individual decision aid.

The Experiment 1 selected XGBoost's 0.5 rule predicted no positive cases; the corrected common holdout contains only 27 lab-positive participants. Alternative threshold rules can recover cases, but do so with false positives, and the observed estimates are too uncertain for a model-selection claim. The model configuration with the largest holdout AUC is not automatically the best screening classifier.

Pima remains unchanged and is not task-equivalent: its historical outcome differs from NHANES current status. NHANES is not a drop-in replacement. Recommended next step: a prospectively specified validation on a second cohort/cycle with design-aware evaluation and a sensitivity-oriented threshold fixed before opening its labels.

Experiment 2 files: [`THRESHOLD_ANALYSIS.md`](THRESHOLD_ANALYSIS.md), [`CALIBRATION_ANALYSIS.md`](CALIBRATION_ANALYSIS.md), [`ROBUSTNESS_ANALYSIS.md`](ROBUSTNESS_ANALYSIS.md), and `threshold_metrics.csv` / `calibration_metrics.json`.
