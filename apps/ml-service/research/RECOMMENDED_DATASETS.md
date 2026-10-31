# Recommended datasets for GlycoTwin

**As of 31 October 2026.** This selection keeps current-status classification, future onset prediction, glucose forecasting and synthetic demo generation as separate tasks. See [the full research report](DATASET_RESEARCH_REPORT.md) for source analysis, scoring and methodology.

## Model A — diabetes classification

**Primary recommendation: NHANES, with an explicitly cross-sectional current-status target.** Start with one well-documented cycle such as 2017–2018 or August 2021–August 2023. Join DEMO, DIQ, relevant examination/lab and optional lifestyle files by same-cycle `SEQN`; use the correct component weights and report survey-weighted prevalence and metrics. Define the target before selecting predictors. If HbA1c or fasting glucose defines the outcome, do not include that same lab as an input to a pre-diagnostic risk score.

**Retain Pima as a baseline.** Pima has only 768 women from a narrow cohort and is a historical five-year-onset task in its source lineage. Preserve it as a reproducibility benchmark, not as evidence that a present-day individual risk model generalizes.

**Backups:** BRFSS for a large self-reported diagnosed-status/lifestyle task; UCI Early Stage Diabetes only to reproduce symptom-screening classification. Neither provides the same clinically measured outcome as NHANES. UK Biobank is the better future incident-risk candidate, but access applications are currently paused and expected to resume late 2026.

## Model B — glucose forecasting

**Best research target after access: T1DEXI for contextual adult T1D forecasting.** It offers substantially more participants than older classic forecasting cohorts, CGM plus insulin and carbohydrate/exercise context, and a four-week study. Request the data through Vivli and do not assume full sleep coverage until the approved release dictionary is reviewed.

**Best immediate baseline: Gluco TSFM Benchmark on Hugging Face.** The compact composite enables univariate 30/60/120-minute experiments and claims participant-level train/test separation. It has no event covariates; its viewer/card count discrepancy, glucose-column naming inconsistency, preprocessing and component licenses need verification before relying on metrics or redistribution.

**Backups by research question:**

- **T2D-specific forecast:** ShanghaiT2DM (100 people, CGM plus meal/diet and medication context; 15-minute sampling; short recordings).
- **Long within-person CGM history:** T1DiabetesGranada (736 people, ~257,780 patient-days; 15-minute FGM; demographics/labs/diagnoses, no verified meal/activity/insulin stream; DUA and noncommercial terms).
- **CGM + meal + activity response:** CGMacros (45 people, only 14 with T2D, ten days; 627.9 MB uncompressed; CC BY-NC-SA 4.0).
- **Compact classic covariate benchmark:** OhioT1DM (12 T1D adults, eight weeks, CGM/insulin/carbs/life events/wearables; institutional request and up-to-one-week stated processing).
- **Long pump histories:** DiaTrend (54 T1D patients, 27,561 CGM days; Synapse controlled access; basal records only for 17 participants).
- **MetaboNet:** promising consolidation, but do not select until the portal’s current subject counts, public-tier files, data schema, source licenses and DUA tiers are reconciled.

All T1D sources are T1D evidence. They do not establish forecast performance in T2D. Use participant-level and within-person future-time holdouts as separate tests.

## Model C — patient profiles and contextual health

**Best for demo patient profiles: Synthea.** Use the official 100-patient CSV or FHIR sample, or generate a controlled synthetic cohort. Display synthetic status prominently. Synthea is simulated EHR data for app integration and workflow testing; it is not real-world clinical validation and does not natively provide longitudinal CGM, logged meals, sleep and wearable data.

**Best real contextual sub-study: CGMacros** for short meal/CGM/activity associations. It is not a complete digital twin and has small groups. Use **NHANES** for cross-sectional population profiles and separate analyses of labs, nutrition recalls, activity and selected-cycle sleep. Use **T1DEXI** or **T1DiabetesGranada** only after approvals for study-specific T1D questions.

## Access decision

Immediately reachable public-use sources: NHANES, BRFSS, Pima mirror, UCI Early Stage, Gluco TSFM, ShanghaiT2DM, CGMacros and Synthea sample. Do not fetch CGMacros until storage and noncommercial license fit are confirmed. BIG IDEAs is 34.1 GB uncompressed and does not fit a short exploratory download.

Requires an application, institutional request or terms flow: T1DEXI (Vivli research proposal, training and DUA), DiaTrend (Synapse certified profile and intended-use statement), T1DiabetesGranada (authenticated Zenodo request and DUA), OhioT1DM (institutional email to custodian), MetaboNet (account plus source-tier terms), UK Biobank (approved institution / RAP; new applications paused as of this snapshot).

## Invalid combinations and claims

- Do not call NHANES prevalent-status classification a future-onset model.
- Do not use Pima’s historical outcome as if it were a cross-sectional lab-confirmed NHANES diagnosis.
- Do not claim a T1D forecast transfers to T2D without an independent T2D evaluation.
- Do not merge participants across unrelated repositories or make synthetic Synthea records “match” real study subjects.
- Do not infer meal, sleep or exercise effects from datasets without aligned observations for those variables.
- Do not make causal or clinical digital-twin claims from feature importance, retrospective correlations, or synthetic data.

## Next 24 hours

1. Freeze Model A’s endpoint: choose current diagnosed status or lab-defined current diabetes, and write down the predictor availability time.
2. Draft NHANES cycle/module join and survey-weight plan; inspect data dictionaries and calculate actual eligible N, missingness and weighted prevalence before modeling.
3. Retain the existing Pima pipeline as its own baseline and update its documentation to distinguish historical onset from prevalence classification in a later implementation change.
4. Create a dataset access proposal and request T1DEXI via Vivli. If the project has a qualifying institutional email, request OhioT1DM too.
5. For immediate, small forecasting research, download Gluco TSFM only after checking its 18.4 MB archive, 46.5 MB expanded size, CC BY-NC-SA terms, row counts and participant IDs. Establish a glucose-only baseline without meal-response claims.
6. If T2D forecasting is the priority, first inspect the Figshare ShanghaiT2DM workbooks and user terms; retain its original 15-minute sampling instead of upsampling to imply better sensor resolution.
7. Use Synthea’s 100-patient CSV sample to prototype app screens and API integration. Tag every synthetic profile.
8. Do not download CGMacros or BIG IDEAs until a concrete experiment, storage budget and license review justify the file size.

