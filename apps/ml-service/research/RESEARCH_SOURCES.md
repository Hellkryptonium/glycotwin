# Research source register

Sources consulted for the dataset review and recommendations. Primary dataset custodians and peer-reviewed papers are preferred. Access pages describe current terms as observed on **2026-10-31**; availability can change. The list records what each source supports, not a claim that participant files were downloaded.

## Population diabetes classification

| Source | Type and date | Supports |
|---|---|---|
| [NCHS NHANES continuous survey portal](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/) | Official CDC portal | Cycle files, documentation, codebooks and public data formats |
| [NHANES 2021–2023 response rates](https://wwwn.cdc.gov/nchs/data/ResponseRates/NHANES-August-2021-August-2023-Response-Rates.pdf) | Official NCHS report | Interview/exam counts: 11,933 interviewed and 8,860 examined |
| [DIQ_L diabetes questionnaire](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/DIQ_L.htm) | Official CDC codebook | Diagnosis, insulin and pill variables, code values and eligibility |
| [DEMO_L demographics](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/DEMO_L.htm) | Official CDC codebook | Participant key, demographics, sample status and weights |
| [BMX_L body measures](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/BMX_L.htm) | Official CDC codebook | BMI field and release-level nonmissing/missing counts |
| [GHB_L glycohemoglobin](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/GHB_L.htm) | Official CDC codebook | HbA1c measurement and lab records/missingness |
| [GLU_L fasting glucose](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/GLU_L.htm) | Official CDC codebook | Fasting glucose subsample and eligibility/weights |
| [NHANES 1999–2018 diabetes prevalence analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC9839558/) | Peer-reviewed population analysis | Historical scale, cross-sectional prevalence context and survey design |
| [CDC BRFSS annual data](https://www.cdc.gov/brfss/annual_data/annual_data.htm) and [2023 release documentation](https://portugues.cdc.gov/brfss/annual_data/annual_2023.html) | Official CDC data portal/documentation | Annual formats, survey scope and 2023 record count |
| [CDC BRFSS questionnaires](https://www.cdc.gov/brfss/questionnaires/) | Official CDC | Core and optional module questionnaire availability |
| [UCI Early-stage Diabetes Risk Prediction](https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset) | UCI repository; dataset paper linked on page | 520 rows, metadata fields, missing-value flag, target context and CC BY 4.0 listing |
| [Early-stage diabetes dataset analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC10043839/) | Peer-reviewed study, 2023 | Reported sample composition and feature/target use |
| [Pima UCI/OpenML archive description](https://github.com/datasets/openml-datasets/blob/main/data/diabetes/README.md) | Curated repository provenance record | 768 rows, 8 predictors, cohort provenance and class counts |
| [Smith et al., ADAP learning algorithm paper](https://doi.org/10.1109/SCAMC.1988.7700) | Primary conference paper, 1988 | Historical Pima study and diabetes onset prediction framing |
| [PIDD source documentation](https://search.r-project.org/CRAN/refmans/LSTbook/html/PIDD.html) | Dataset documentation | Five-year follow-up interpretation and variables |
| [Hugging Face Pima mirror](https://huggingface.co/datasets/khoaguin/pima-indians-diabetes-database) | Dataset card and files | Project's existing mirror/version and declared license; this does not settle original rights |
| [UK Biobank apply for access](https://www.ukbiobank.ac.uk/use-our-data/apply-for-access/) and [how access works](https://www.ukbiobank.ac.uk/about-us/how-we-work/access-to-uk-biobank-data/) | Official custodian access pages | Eligible projects, application/RAP process and snapshot application pause |
| [CDC Diabetes Health Indicators secondary data dictionary](https://gedeck.github.io/DS-6030/datasets/diabetes.html) | Secondary documentation | Common derived 2015 BRFSS subset; not a substitute for CDC raw annual files |

## Glucose forecasting and contextual datasets

| Source | Type and date | Supports |
|---|---|---|
| [Gluco TSFM Benchmark dataset card/viewer](https://huggingface.co/datasets/byluuu/gluco-tsfm-benchmark) | Public dataset card and viewer, submitted 2026 | Viewer schema/count versus card discrepancies, component sources, nominal cadence, transformations and declared license |
| [GlucoFM-Bench paper](https://arxiv.org/abs/2606.06881) | Preprint, 2026 | Benchmark framing and cross-dataset forecasting context |
| [T1DEXI primary study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10090894/) | Peer-reviewed study | Enrollment, adult T1D exercise design, CGM and observation scope |
| [Vivli data request](https://vivli.org/resources/requestdata/) and [Vivli FAQs](https://vivli.org/resources/faqs/) | Data custodian access instructions | Study request, training, agreement and typical review process |
| [Jaeb diabetes dataset listings](https://public.jaeb.org/datasets/diabetes) | Study data portal | T1DEXI dataset/access listing |
| [DiaTrend paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10447420/) | Scientific Data paper, 2023 | Cohort size, CGM/pump coverage, workbook field names and collection scope |
| [Synapse DiaTrend record](https://www.synapse.org/Synapse:syn53783850) | Data portal record | Current controlled-access location and certification route |
| [T1DiabetesGranada paper](https://www.nature.com/articles/s41597-023-02737-4) and [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC10733323/) | Scientific Data paper, 2023 | Participants, glucose row count, measurement intervals and described CSV files |
| [T1DiabetesGranada Zenodo record](https://zenodo.org/records/10050944) | Repository record and DUA | Request path, license/terms and archive availability |
| [OhioT1DM official dataset page](https://webpages.charlotte.edu/rbunescu/data/ohiot1dm/OhioT1DM-dataset.html) | Custodian page | 12 participants, 8-week collection, request and DUA process |
| [OhioT1DM paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7881904/) | Peer-reviewed study, 2021 | XML structure, signal/event types, train/test chronology and coverage limitations |
| [MetaboNet platform](https://metabo-net.org/) and [about/access page](https://metabo-net.org/about) | Platform/custodian pages | Current advertised cohorts, access tiers and count discrepancies |
| [MetaboNet paper](https://arxiv.org/abs/2601.11505) | Preprint, 2026 | Published participant and patient-year totals and source consolidation |
| [Shanghai diabetes dataset paper](https://www.nature.com/articles/s41597-023-01940-7) | Scientific Data paper, 2023 | T1D/T2D cohort descriptions, collection design and signal context |
| [Shanghai dataset Figshare collection](https://figshare.com/collections/Diabetes_Datasets_ShanghaiT1DM_and_ShanghaiT2DM/6310860/2) | Repository collection | Public file access and per-record metadata/terms to recheck before use |
| [PhysioNet CGMacros v1.0.0](https://physionet.org/content/cgmacros/1.0.0/) | Official dataset record | Public status, size, license and file dictionary links |
| [CGMacros study paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12462512/) | Peer-reviewed paper | Participants, diagnostic groups, monitoring duration, devices and collection process |
| [PhysioNet CLI repository](https://github.com/MIT-LCP/physionet) | Official custodian tooling documentation | Install package (`python -m pip install physionet`) and public download command syntax |
| [D1NAMO repository](https://zenodo.org/records/5651217) and [dataset paper](https://doi.org/10.1016/j.imu.2018.09.003) | Zenodo record and peer-reviewed paper | Modalities, cohort description and CC BY-SA 4.0 repository terms |
| [BIG IDEAs Glycemic Wearable dataset](https://www.physionet.org/content/big-ideas-glycemic-wearable/1.1.0/002/) | Official PhysioNet record | Cohort, file inventory, size and ODC-By terms |

## Synthetic EHR and evaluation guidance

| Source | Type and date | Supports |
|---|---|---|
| [Synthea project](https://synthetichealth.github.io/synthea/) | Official project | Synthetic-patient generator scope and output formats |
| [Synthea download portal](https://synthetichealth.github.io/downloads.html) | Official project | Sample and bulk downloads, stated data-use status and archive sizes |
| [Walonoski et al., Synthea](https://doi.org/10.1093/jamia/ocx079) | JAMIA paper, 2018 | Synthetic patient generation method and intended use |
| [NCHS analytic guidelines](https://wwwn.cdc.gov/nchs/nhanes/analyticguidelines.aspx) | Official survey analysis guidance | Weighting, complex design, component eligibility and variance estimation |
| [Battelino et al., International Consensus on Time in Range](https://doi.org/10.2337/dci19-0028) | Peer-reviewed consensus, 2019 | CGM clinical target context and appropriate limits on interpreting forecast metrics |

## Source and license caveats

- A host platform's license declaration does not necessarily clear rights in every component cohort. Retain original-source citations and verify the terms for the exact files and intended use.
- “Public” means available from a public portal; it does not by itself authorize commercial use, redistribution, linkage or re-identification.
- Controlled datasets were researched from papers and access pages only. This report does not represent that applications were submitted or participant data were acquired.
