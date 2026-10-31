# GlycoTwin NHANES research cycle — final decision

## Decision

NHANES is retained as an **experimental cross-sectional research baseline** for studying model behavior on a survey-derived, laboratory-defined current-status target. **No classifier from this work is approved for user-facing diabetes risk assessment, screening, diagnosis, or individual decisions.** The models estimate neither future diabetes onset nor confirmed clinical diagnosis. No model is promoted based on small differences in holdout ranking metrics.

## Dataset and target

The work uses the CDC's NHANES 2017–2018 public-use cycle, joined from ten official modules: demographics, diabetes questionnaire, body measures, blood pressure, HbA1c, fasting glucose, physical activity, two dietary recalls, and sleep. The primary exploratory target is restricted to adults age 20 or older who answered `DIQ010=2` (not previously told they have diabetes) and have both HbA1c and fasting glucose measured. A participant is labeled positive when HbA1c is at least 6.5% **or** fasting glucose is at least 126 mg/dL; controls have both observed results below those cutoffs. The original complete-lab cohort had **1,939 participants: 129 positive and 1,810 controls**.

A separate secondary target represents self-reported prior diagnosis (`DIQ010=1` versus `DIQ010=2`) among **5,393 adults**: 876 yes and 4,517 no. This target describes reported diagnosis, not undiagnosed diabetes. The two targets must not be conflated.

## Experiment 1 — baseline

Experiment 1 used the NHANES complete-lab cohort of 1,939 for the primary target. The split was stratified, 75/25, with seed 42: 1,454 training participants (97 positive, 1,357 control) and a 485-person holdout (32 positive, 453 control). The secondary target used 5,393 participants and a 1,349-person holdout. Three prespecified feature sets were compared: demographics; demographics plus anthropometrics; and full non-laboratory predictors. Model pipelines imputed missing predictors, with preprocessing fitted inside training folds. Five-fold stratified CV selected the model with the highest mean ROC-AUC within each feature set. The holdout was evaluated at the fixed 0.5 threshold.

For the primary target and full feature set, CV selected XGBoost. On the 485-person holdout, XGBoost had ROC-AUC **0.799** and average precision **0.173**, but at threshold 0.5 it classified all 32 positive participants as negative (sensitivity 0%). Random Forest had the largest observed full-feature holdout ROC-AUC (**0.812**) and average precision (**0.184**) but sensitivity was **3.1%** (1/32) at 0.5. Logistic Regression had **75.0%** sensitivity, with **67.1%** specificity and **13.9%** precision. This showed that ranking and a fixed-threshold operating point answer different questions.

## Experiment 2 — thresholds, imbalance, calibration, and robustness

Experiment 2 preserved the Experiment 1 positional split and restricted both partitions to participants with a positive fasting subsample weight, as described below. Its primary target cohort is therefore **1,823 people: 115 positive and 1,708 controls**. The corrected split has **1,368 training participants (88 positive)** and **455 holdout participants (27 positive)**. The smaller holdout has too few positive observations for precise threshold or subgroup conclusions.

On the corrected full-feature cohort, Experiment 2 compared the baseline class-weighted Logistic Regression, balanced-subsample Random Forest, and unweighted XGBoost with an XGBoost configuration whose `scale_pos_weight` was calculated from each training fit. Repeated 5-fold stratified CV (five repeats) and sigmoid calibration were confined to training data. Imputation/scaling was fitted within each fold. Thresholds from 0.05 through 0.95 were selected from repeated out-of-fold training predictions using Youden's J, F1, or a prespecified sensitivity target; holdout labels did not select thresholds. No SMOTE or pre-split oversampling was used.

Repeated-CV ROC-AUC means were close (0.691–0.705) with fold standard deviations of 0.060–0.075, so there was no clear class-imbalance strategy winner. On the holdout, raw-to-sigmoid Brier scores were 0.1993→0.0545 for Logistic Regression, 0.0585→0.0533 for Random Forest, 0.0532→0.0542 for unweighted XGBoost, and 0.1339→0.0530 for weighted XGBoost. These are noisy estimates from a holdout with 27 positives; sigmoid calibration did not turn these unweighted scores into survey-representative or clinically calibrated personal risks.

Random Forest again had the strongest corrected-holdout ranking metrics among these candidates (ROC-AUC **0.799**, average precision **0.178**), but that does not establish a useful operating point:

- At its training-OOF Youden threshold of 0.15, holdout sensitivity was **70.4%**, specificity **72.2%**, and precision **13.8%**: 19 true positives, 119 false positives, and 8 false negatives.
- At the training-OOF threshold of 0.05 selected to achieve at least 80% sensitivity, holdout sensitivity was **96.3%**, but specificity was **29.7%** and precision **8.0%**: 26 true positives, 301 false positives, and 1 false negative.
- At the fixed 0.5 reference threshold, Random Forest sensitivity was **0%** on the corrected holdout. ROC-AUC summarizes ranking across thresholds and cannot select a useful operating point by itself.

There were only 27 holdout positives, so one additional correctly identified case changes measured sensitivity by about 3.7 percentage points. Bootstrap intervals preserve the observed case/control counts and do not account for NHANES strata, primary sampling units, or survey weights. The subgroup cells are sparse and do not support fairness conclusions. Sigmoid calibration was fit on training data only; isotonic calibration was omitted because there were only 88 training positives. Brier scores and reliability diagrams remain small-sample, unweighted evaluations and do not establish nationally representative or personal risk probabilities.

## Fasting subsample weight correction

The Experiment 1 model cohort included **116 participants without a positive `WTSAF2YR` fasting subsample weight**. The official NHANES 2017–2018 GLU_J documentation identifies a zero fasting weight with no fasting lab result or failure to meet the 8-to-less-than-24-hour fasting requirement; fasting glucose results can still exist for some people who did not meet that fasting criterion, but their inclusion in a fasting analysis requires reweighting. All 116 participants had both target lab values in the processed cohort, so this was not simply a missing-lab issue. Their records are ineligible for the standard fasting-weight analysis without an appropriate reweighting method.

Experiment 1's original unweighted model results and artifacts are preserved as run. Experiment 2 excluded these 116 from both partitions while retaining the original split positions: **86 from training and 30 from the holdout**. This changed the primary target cohort from N=1,939 (129 positive) to N=1,823 (115 positive), and the corresponding split from 1,454/485 (97/32 positive) to 1,368/455 (88/27 positive). `WTSAF2YR` was used for eligibility and weighted prevalence context, not as an ML training or metric weight. The original and corrected experiments are consequently not identical evaluation populations.

See the [CDC GLU_J codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/GLU_J.htm) and the Experiment 2 [methodology audit](experiment_2/ROBUSTNESS_ANALYSIS.md) for details.

## Limitations and scope

- NHANES is a single cross-sectional survey cycle. The primary label is a research threshold applied to one collection, not confirmed diagnosis or future-onset prediction.
- The original primary cohort has 129 positives; the corrected Experiment 2 training cohort has 88 and its holdout has 27. Threshold estimates and subgroup results have substantial uncertainty.
- Ordinary model fitting, CV, holdout metrics, and participant bootstrap intervals are not survey-design-aware; no NHANES strata/PSU design-based model performance estimates are reported. Weighted prevalence values are point estimates only.
- The target requires both labs and excludes other eligible adults with one or both measurements missing. NHANES nonresponse, fasting eligibility, and module participation affect cohort representation.
- Experiment 1 used a single holdout and five-fold CV; Experiment 2 adds repeated CV but does not create an independent external validation cohort. Threshold optimization within training OOF predictions still has selection uncertainty.
- Probability calibration is not equivalent to clinical risk calibration. Neither experiment validates an individual probability for user presentation.
- Pima has a different population, predictors, and historical outcome. These NHANES results are not a head-to-head comparison and do not replace the Pima implementation.

## Research disposition

Keep NHANES as a documented research baseline and retain both experiments' outputs for reproducibility. Do not expose these classifiers or scores through the product. Any later assessment should prespecify the target, fasting eligibility, operating threshold, survey-aware evaluation, and independent validation cohort before evaluating its labels.

## Experiment records

- Experiment 1: [`README.md`](README.md), [`MODEL_COMPARISON.md`](reports/MODEL_COMPARISON.md), [`LIMITATIONS.md`](reports/LIMITATIONS.md), and [`DATASET_AUDIT.md`](reports/DATASET_AUDIT.md).
- Experiment 2: [`UPDATED_MODEL_COMPARISON.md`](experiment_2/UPDATED_MODEL_COMPARISON.md), [`THRESHOLD_ANALYSIS.md`](experiment_2/THRESHOLD_ANALYSIS.md), [`CALIBRATION_ANALYSIS.md`](experiment_2/CALIBRATION_ANALYSIS.md), and [`ROBUSTNESS_ANALYSIS.md`](experiment_2/ROBUSTNESS_ANALYSIS.md).
