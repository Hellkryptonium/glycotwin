# Dataset schema and data-quality notes

**Snapshot:** 2026-10-31. This note distinguishes schema directly inspected from schema described in published papers or repository metadata. No access-controlled archives were obtained, and large public archives (including CGMacros) were not downloaded. Missingness counts below are only for the specified module/release and are not the final analytic sample.

## Directly inspected

### Existing local Pima CSV

The existing ML-service CSV was read without modifying it. It has 768 rows and these columns:

`Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age, y`

There are no encoded nulls. Target counts are `y=0: 500` and `y=1: 268`. Physiological fields contain zero values (including glucose, blood pressure, skin thickness, insulin and BMI); these are not nulls, and many represent missing measurements in common Pima curation. The file's `y` name differs from the common `Outcome` name. Do not silently treat those zeros as physiologically valid or as missing without documenting the rule. The data are a narrow historical cohort, and the five-year outcome interpretation comes from source documentation, not from a time-to-event column in this CSV.

### NHANES August 2021–August 2023 public codebooks

The official component documentation and response-rate counts were inspected online, but XPT participant data were not downloaded in this research pass.

| Component | Fields / type notes | Counts and missingness observed in official documentation |
|---|---|---|
| `DEMO_L` | `SEQN` participant key; `SDDSRVYR`, `RIDSTATR`; `RIAGENDR`, `RIDRETH3` coded categories; `RIDAGEYR` age (top-coded at 80); interview, MEC and fasting weights | 11,933 interview respondents and 8,860 examined participants in the cycle response-rate report |
| `DIQ_L` | `DIQ010` self-reported professional diagnosis (1 yes, 2 no, 3 borderline, refusal/unknown codes); `DIQ050` insulin; `DIQ070` diabetes pills | Codebook defines eligibility and refusal/unknown values; final complete cases depend on joins and target rule |
| `BMX_L` | Continuous body-measurement fields, including `BMXBMI` | `BMXBMI`: 8,471 nonmissing and 389 missing among 8,860 MEC records |
| `GHB_L` | `LBXGH` numeric HbA1c (%) | 6,715 observations and 484 missing among 7,199 records in the lab file |
| `GLU_L` | `LBXGLU` fasting glucose (mg/dL) plus fasting subsample design | Fasting subsample only; use the component's fasting weights and eligibility rules |

Join component files by `SEQN` only within the same release. Keep special refusal, don't-know and ineligible codes separate from ordinary missingness. Self-report status and lab thresholds answer different questions; lab variables used to define a label must not also be included as predictors in a model advertised as prediagnostic risk.

### Gluco TSFM Benchmark Hugging Face viewer

The viewer schema exposes `dataset` (string), `subject_id` (string), `timestamp` (list of float64 Unix timestamps) and `BGvalue` (list of float64 glucose values). One row represents a subject series. The card prose instead uses `BGvalues`; train/test viewers show 529 rows each while card metadata states 549 each. Resolve the field and count discrepancies against the downloaded manifest before relying on the benchmark. Check every paired-array length, monotonic timestamps, gaps, split subject IDs and original-source attribution.

## Schema described by primary paper / official data dictionaries; participant files not fetched

### CGMacros

The official PhysioNet dictionaries were opened online. The participant archive (about 628 MB uncompressed) was not downloaded, so per-person missingness, actual timestamp spacing, photo annotation quality and values are not checked.

Main participant dictionary fields include `Timestamp`, `Libre GL`, `Dexcom GL`, `HR`, `Calories (Activity)`, `Mets`, `Meal Type`, `Calories`, `Carbs`, `Protein`, `Fat`, `Fiber`, `Amount Consumed`, and `Image Path`. Glucose is mg/dL; the timestamps are randomized/shifted. The documented series are aligned/interpolated to one-minute rows; that is not native one-minute CGM resolution. The baseline dictionary lists `Age`, `Gender`, `BMI`, `Body weight`, `Height`, `Self-identify`, `A1c PDL (Lab)`, `Fasting GLU - PDL (Lab)`, insulin, triglycerides, cholesterol, HDL, non-HDL, calculated LDL/VLDL, ratio, collection time and three fingerstick glucose/time fields. Confirm exact capitalization and which optional fields exist in each participant CSV before coding a loader.

### DiaTrend

Paper-described workbook structure: one Excel file per participant. CGM sheet fields `date`, `mg/dL`; Bolus sheet fields `date`, `normal`, `carbInput`, `insulinCarbRatio`, `bgInput`, `recommended.carb`, `recommended.net`; Basal sheet fields `date`, `duration`, `rate` and exists for 17 of 54 participants. Paper reports 27,561 CGM days and 8,220 pump-data days. It is unsafe to assume every CGM timestamp aligns with complete insulin/carbohydrate data; inspect sheets after approved Synapse access.

### T1DiabetesGranada

Paper describes four CSVs: `Patient_info.csv` (736 rows; fields include `Patient_ID`, `Sex`, `Birth_year`, initial/final measurement dates, counts of measurement days/readings and biochemical parameters, diagnosis count); `Glucose_measurements.csv` (`Patient_ID`, `Measurement_date`, `Measurement_time`, `Measurement` in mg/dL); `Biochemical_parameters.csv` (`Patient_ID`, `Reception_date`, `Name`, `Value`); and `Diagnostics.csv`. Do not assume exact `Diagnostics.csv` column labels from summary text; confirm from the released archive. Paper reports 22,671,708 glucose rows; FreeStyle Libre nominally records every 15 minutes when scanned, with gaps possible when the sensor is not scanned. Archive was not fetched.

### OhioT1DM

Paper-described XML records have elements for patient, glucose level, finger stick, basal and temporary basal, bolus, meal, sleep, work, stressors, hypoglycemia events, illness, exercise, and wearable signals (heart rate, GSR, skin/air temperature, steps, sleep and acceleration). Official materials describe 12 participants and 24 files. Sensor coverage varies; some participants did not wear wearable sensors overnight. Archive was not obtained.

### T1DEXI

Paper reports Dexcom G6 CGM, insulin delivery, exercise sessions, carbohydrate intake and app-recorded study information. The Vivli archive's exact tables, field names, missingness and sleep coverage remain unknown until approved access. Do not infer sleep availability from the study's context-rich characterization.

### ShanghaiT2DM

Paper-level description: 100 people with T2D, CGM over 3–14 days, meals and clinical/event measures; a separate ShanghaiT1DM cohort is also in the collection. The files are described as spreadsheets and contain repeated visits for some people. Exact worksheet names, column labels and field-level missingness were not checked in this pass.

### MetaboNet

The paper and current platform page describe CGM and insulin pump data, with carbohydrate and exercise context for some sources. No data dictionary or file preview was available without account access. Published and platform-level totals conflict; exact schema, source provenance, time zone, sampling cadence and missingness all require release-level verification.

## Metadata-level only; exact raw fields not inspected

- **UCI Early-stage Diabetes Risk:** UCI metadata describes 520 records and 16 features plus a class label, and flags missing values. Published descriptions vary in whether “16” refers to input features or total variables. Inspect downloaded file headers, category encodings, missing tokens and questionnaire/diagnosis timing before modeling.
- **BRFSS:** annual CDC layouts and modules vary. The common “Diabetes Health Indicators” table is a derived 2015 subset, not the raw annual CDC release; document its row selection and self-report outcome if used.
- **UK Biobank:** fields and analytic sample depend on approved application and UKB-RAP query; no individual-level access occurred.
- **D1NAMO:** repository/paper describe glucose, ECG, breathing, accelerometer and food-image data. Exact file layout and participant-level missingness require archive inspection.
- **BIG IDEAs:** repository lists CGM, food log and wearable files (ACC, BVP, HR, IBI, EDA, temperature, etc.); 34.1 GB uncompressed. No data archive was fetched.
- **Synthea:** output formats depend on generator settings (CSV, FHIR and others). Typical synthetic EHR resources include patients, encounters, conditions, medications and observations; no default measured CGM, meal, sleep or activity stream. No generated sample was inspected here.

## Schema handling requirements before a modeling dataset is built

1. Record exact source URL, release/version, terms and file checksum for every file.
2. Preserve original labels and units in a raw layer; normalize only in a separate documented transformation.
3. Report participant counts, valid timestamps, missingness, duplicates, sampling intervals and gaps by participant and signal.
4. Distinguish absent values, ineligible records, sensor gaps, refusals, device failures and values encoded as zero.
5. For CGM, retain source participant IDs and source dataset so group splits and source-held-out evaluation can be enforced; never split overlapping windows randomly across train/test.
