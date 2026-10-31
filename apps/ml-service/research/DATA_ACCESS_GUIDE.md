# Data access guide

Guide checked 31 October 2026. Exact current forms and terms may change; follow the linked custodian instructions and retain the version/DOI used. No access-controlled data was requested on the user’s behalf.

## Public access without an application

### NHANES

1. Open the [NHANES data and documentation portal](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/).
2. Select one cycle (for example `2021–2023`) and download the relevant XPT data and codebooks: `DEMO_L`, `DIQ_L`, `GHB_L`, `BMX_L`, and the chosen physical activity / dietary / sleep files. Add `GLU_L` only if using fasting glucose; it is a subsample and needs appropriate weight handling. Cycle suffixes and offerings change, so use the portal rather than hard-coding another cycle’s names.
3. Join modules by `SEQN` only within that cycle. Preserve missing-value/refusal codes, component eligibility and weights. Public XPT files are small enough for ordinary analysis; no special account was needed in the public portal.

Example PowerShell download pattern for a file whose path is listed in the portal:

```powershell
New-Item -ItemType Directory -Force data\nhanes | Out-Null
Invoke-WebRequest `
  -Uri 'https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/DEMO_L.xpt' `
  -OutFile 'data\nhanes\DEMO_L.xpt'
```

Download matching codebooks alongside data; do not copy variables across cycle suffixes without checking definitions. Cite NCHS/CDC and survey cycles. Public-use status is not permission to re-identify respondents.

### BRFSS

1. Use the [CDC annual survey data portal](https://www.cdc.gov/brfss/annual_data/annual_data.htm) and select a year.
2. Download raw ASCII/SAS transport files and the matching annual questionnaire, codebook/format files, and weighting documentation.
3. The core is broadly standardized, but optional modules vary by jurisdiction/year. Preserve `DIABETE4`/current-year diagnosis fields and special codes as documented. Use final weights/design information for population estimates.

The common 2015 “Diabetes Health Indicators” table is a derived Kaggle/UCI dataset, not the raw BRFSS master release. If using it, record its exact binary or 3-class file and note any resampling/balancing. Do not describe it as lab-confirmed diabetes.

### Pima

The existing ML service already has the downloaded Hugging Face mirror. To independently fetch the same mirror:

```powershell
New-Item -ItemType Directory -Force data\pima | Out-Null
Invoke-WebRequest `
  -Uri 'https://huggingface.co/datasets/khoaguin/pima-indians-diabetes-database/resolve/main/diabetes.csv' `
  -OutFile 'data\pima\diabetes.csv'
```

The mirror’s page declares Apache-2.0, but document both the exact mirror and original NIDDK/Smith provenance. Do not infer that one mirror declaration grants unrestricted rights to all upstream data. Validate header, 768 rows, both classes, and the `y`/`Outcome` target naming in the selected file.

### UCI Early Stage Diabetes

Use [UCI dataset id 529](https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset), which provides download/API instructions and lists CC BY 4.0. Inspect its missing values and symptom/diagnosis timing. No application was listed.

### Gluco TSFM Benchmark

The Hugging Face dataset card provides a direct `datasets` loading example. After review of CC BY-NC-SA and source dataset conditions:

```powershell
python -m pip install datasets
python -c "from datasets import load_dataset; d=load_dataset('byluuu/gluco-tsfm-benchmark'); print(d); print(d['train'].features)"
```

The card currently reports 18.4 MB download size and 46.5 MB expanded data. Before training, compare actual split counts with both its viewer and card, confirm participant IDs are disjoint, check each timestamp/value array length, and review the original-source license matrix. Do not redistribute a merged/reprocessed copy without complying with each source’s terms. The license is noncommercial/share-alike; it is not suitable for a commercial product without legal review/permission.

### ShanghaiT1DM / ShanghaiT2DM

Use the [Figshare collection](https://figshare.com/collections/Diabetes_Datasets_ShanghaiT1DM_and_ShanghaiT2DM/6310860/2) linked from the original paper. Download only the desired T2DM/T1DM files and documentation, inspect Excel sheet/column names, and cite the Scientific Data article and DOI. The collection is publicly downloadable; confirm the version’s license metadata before use. Keep the original 15-minute sampling cadence for evaluation.

### CGMacros

PhysioNet lists a public archive at [CGMacros v1.0.0](https://physionet.org/content/cgmacros/1.0.0/), no application, CC BY-NC-SA 4.0. Size is 627.9 MB uncompressed; check local storage first. The custodian lists these commands:

```powershell
python -m pip install physionet
physionet download cgmacros --version 1.0.0
```

or (AWS CLI required):

```powershell
aws s3 sync --no-sign-request s3://physionet-open/cgmacros/1.0.0/ data\cgmacros
```

Also download/read `DataDictionary.pdf` and the CSV dictionaries. The no-sign-request command is published by PhysioNet, but use only under the license and cite the DOI. Do not download it merely to inspect the schema; the dictionary is under 1 MB.

### Synthea / SyntheticMass

Use the [official sample downloads page](https://synthetichealth.github.io/downloads.html). It lists 100 synthetic patient CSV records (~7 MB) and FHIR samples. No account or data-use agreement is required. The one-million-record archive is 21 GB, so it is unnecessary for this prototype. Cite Walonoski et al. and label every record synthetic. Alternatively, use the [Synthea generator](https://github.com/synthetichealth/synthea) to create a small deterministic cohort; keep the generator version, seed and module configuration.

## Application / controlled access

### T1DEXI via Vivli

1. Register with [Vivli](https://vivli.org/), find the T1DEXI adult study, and submit a concrete research proposal with purpose, analysis plan, requested variables and outputs.
2. Complete required data-access training; execute the standard Vivli DUA and obtain data contributor/IRB approvals.
3. Vivli says approval commonly takes a few months. Do not plan on same-day data. Download or use the approved secure environment according to study-specific terms.
4. After access, inspect data dictionary, date precision, participant split keys, CGM/insulin/meal event coverage, sensor timezone, and sleep data before making feasibility claims.

### DiaTrend

1. Register for [Synapse](https://www.synapse.org/).
2. Become a Synapse Certified User with a validated profile.
3. Submit an intended-data-use statement and agree to conditions prohibiting re-identification and commercial advertising/recontact, requiring secure handling and attribution.
4. Inspect the original study documentation. Expected paper-described artifacts are subject Excel files with CGM/bolus and a basal sheet for only 17 subjects; verify the actual version before modeling.

### T1DiabetesGranada

1. Create/authenticate a Zenodo account and visit [record 10050944](https://zenodo.org/records/10050944).
2. Accept the record’s Data Usage Agreement and request access with full name, email and research justification.
3. The data custodian’s terms require confidentiality/security, no re-identification, no redistribution, no commercial use/recontact, and citation. Each analyst needs to follow the agreement individually.
4. Only after approval retrieve the CSV archive. It is 22.67 million glucose rows plus patient/biochemical/diagnosis files. Confirm date/time alignment, scan gaps, duplicate records and missing patient metadata.

### OhioT1DM

The [custodian’s dataset page](https://webpages.charlotte.edu/rbunescu/data/ohiot1dm/OhioT1DM-dataset.html) asks for a request from an **institutional email account**, subject line `OhioT1DM Request`, full name/title/email, institution and postal address. The custodian says an encrypted archive and password are sent after processing and to allow up to one week. Cite Marling & Bunescu (2020); treat access as research use, not commercial redistributable data.

### MetaboNet

Create a free account/sign in at [MetaboNet](https://metabo-net.org/). The platform describes a public tier and DUA-protected source tier. Select specific source datasets, read original license/DUA for each, and download only after verifying a current data dictionary and file manifest. The public website and 2026 paper report inconsistent aggregate counts, so record the exact version and compute included participant-days from the actual release. No direct anonymous download was confirmed.

### UK Biobank

Access is restricted to eligible researchers affiliated with a recognized research organization and a health-related, public-interest project; access is via UKB-RAP under legal agreement. As of this report date, the [application page](https://www.ukbiobank.ac.uk/use-our-data/apply-for-access/) states that new applications are paused while the platform changes and are expected to reopen in late 2026. Confirm status before planning. It cannot be treated as available for an immediate prototype.

## Licensing summary

- Public access is not identical to a permissive software/data license. Keep citation, attribution and any share-alike, noncommercial and no-redistribution terms.
- Gluco TSFM Benchmark: HF page says CC BY-NC-SA 4.0 and requires compliance with original cohort licenses.
- CGMacros: CC BY-NC-SA 4.0.
- D1NAMO: CC BY-SA 4.0 (per Zenodo source record).
- BIG IDEAs: Open Data Commons Attribution License 1.0.
- UCI Early Stage: CC BY 4.0 per UCI metadata.
- Synthea sample data is described by its official site as usable without restriction; cite the generator/paper. Generator source code is Apache-2.0.
- T1DEXI, DiaTrend, T1DiabetesGranada, OhioT1DM and UK Biobank are governed by account, access agreement or custodian terms, not an assumed open license.
- NHANES and BRFSS public-use data have custodian documentation and use conditions; cite the release and do not attempt respondent identification.

