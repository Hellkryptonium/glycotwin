# Cohort flow

The complete flow and module counts are in `../data/processed/cohort_flow.csv` and `cohort_summary.json`. Age restriction and target-specific eligibility are applied before feature imputation; missing predictors are retained and imputed within each training fold.

| Stage | N | Details |
|---|---:|---|
| all merged participants | 9,254 | Unique SEQN after validated left joins |
| adults age 20+ | 5,569 | RIDAGEYR >= 20 |
| adults with DIQ010 yes | 876 | Previously diagnosed; excluded from primary undiagnosed cohort |
| adults with DIQ010 no | 4,517 | Eligible diagnosis response |
| adults with ambiguous or missing DIQ010 | 176 | Excluded from both target cohorts; never recoded as negative |
| DIQ010 no but one or both labs missing | 2,578 | Excluded from primary lab composite; see module-specific missingness |
| DIQ010 no, missing HbA1c | 466 | Can overlap the fasting-glucose missing count |
| DIQ010 no, missing fasting glucose | 2,575 | Fasting subsample; can overlap HbA1c missing count |
| DIQ010 no, both labs missing | 463 | Subset of either-lab-missing exclusions |
| primary complete-lab eligible | 1,939 | DIQ010=2 and both LBXGH and LBXGLU observed |
| primary lab eligible without WTSAF2YR | 116 | Retained for unweighted model analysis; excluded from weighted prevalence denominator |
| primary lab cases | 129 | LBXGH >= 6.5 OR LBXGLU >= 126 |
| primary lab controls | 1,810 | Both labs observed and both below thresholds |
| secondary self-report eligible | 5,393 | DIQ010 in {1,2}; adults only |
| secondary self-report cases | 876 | DIQ010=1 |
| secondary self-report controls | 4,517 | DIQ010=2 |

## Survey-weighted point estimates

- Lab-defined primary target among complete-lab, non-diagnosed adults: 0.0402301842388834 using `WTSAF2YR` (N=1,823).
- Self-reported diagnosis among adults with DIQ010 yes/no: 0.1176468535107622 using `WTINT2YR` (N=5,393).

These are weighted point estimates without design-based confidence intervals. Model metrics below are unweighted.
