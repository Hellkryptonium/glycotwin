# Limitations and research safeguards

- **Cross-sectional outcome:** one NHANES examination cannot establish future onset. The primary outcome marks a single survey lab observation meeting an operational threshold, not a confirmed clinical diagnosis.
- **Target construction:** the OR of HbA1c >= 6.5% and fasting glucose >= 126 mg/dL is a prespecified exploratory label. Requiring both measures to be observed makes controls interpretable but excludes many adults. A positive on either measure can still be affected by single-measurement variability.
- **Selection and weight:** the fasting subsample restricts the primary target. Its complete-lab cohort is N=1,939, with 129 positives; complex survey weighting affects population estimates. Weighted prevalence has no design-based standard error in this experiment. ML metrics are unweighted and are not nationally representative.
- **Missing predictors:** outcome-eligible participants remain in model datasets when predictors are missing. Median/mode imputation and missing indicators are fitted within the training pipeline/CV fold. Complete-case counts are separately reported to expose selection.
- **Lifestyle measurement:** PAQ and sleep are self-reported; dietary recall covers one or two days and is not habitual intake. Activity duration and sleep variables have skip patterns, nonresponse and recall error.
- **Validation:** a single stratified 25% holdout, fixed seed and 5-fold training CV support reproducibility, not robust performance claims. Test metrics are uncertain. Bootstrap intervals are ordinary person-level intervals, not survey-design intervals.
- **Subgroups:** sex/race subgroup metrics are suppressed unless each cell has at least 20 positives and 20 negatives; this is a stability safeguard, not a fairness determination. Survey representation and measurement differences remain.
- **Prediction use:** lab predictors are excluded; `SEQN`, target-derived fields, medications and diagnosis questionnaire answers are excluded. Nonetheless, demographic/anthropometric associations are not causal and model scores are not calibrated personal risk.
- **Population and transport:** this is one U.S. survey cycle with NHANES nonresponse, eligibility and measurement limits. External validation on a later NHANES cycle or a separate cohort is required.
- **Pima comparison:** Pima's historical class and its 768-person cohort differ from NHANES current-status classification. Metric differences do not prove that one classifier is intrinsically better.

## Recommended next steps

1. Re-run the primary experiment with a prespecified sensitivity-oriented operating point selected only inside training data, and report its held-out results without further tuning.
2. Add survey-design-aware uncertainty and evaluation for NHANES (strata, PSU and fasting weights), or keep results explicitly exploratory as here.
3. Perform a second-cycle external validation with a harmonized lab target and confirm eligibility/measurement differences.
4. Keep this model outside the production API until clinical endpoint review, calibration, external validation and prospective evaluation are completed.

Raw XPT and row-level processed cohorts are ignored by Git. No participant-level data should be committed.
