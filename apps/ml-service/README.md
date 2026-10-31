# GlycoTwin Model A — Diabetes Risk Classification

This directory contains a separate Python research service. It is not part of the production patient authentication or consent workflow.

An educational, reproducible binary classification prototype built with scikit-learn, XGBoost, and FastAPI. It is **not** a clinically validated diagnostic system. The returned model probability is not a clinically calibrated personal risk.

## Service and research structure

- `app/main.py` — FastAPI application and endpoints.
- `app/services/` — dataset loading and inference.
- `app/models/` — scikit-learn/XGBoost pipeline construction.
- `scripts/download_data.py` — validated dataset download.
- `scripts/train.py` — model selection, evaluation, and artifact generation.
- `tests/` — service and data validation tests.
- `experiments/nhanes/` — separate NHANES research experiment.
- `research/` — dataset access, schema, and limitations documents.

## Dataset

The downloader retrieves the 768-row `diabetes.csv` file from [Hugging Face: khoaguin/pima-indians-diabetes-database](https://huggingface.co/datasets/khoaguin/pima-indians-diabetes-database), which documents the Pima Indians Diabetes Database and Apache-2.0 license. Attribution: National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK), Pima Indians Diabetes dataset, as distributed through the linked dataset repository. The source viewer currently calls the binary label `y`; the loader accepts that source name and normalizes it in memory to `Outcome`. The downloaded original bytes are preserved under `data/raw/diabetes.csv`. Downloads are rejected unless the feature schema, 768 row count, and binary target validate. A failure does not trigger a fallback dataset.

Zero values in Glucose, BloodPressure, SkinThickness, Insulin, and BMI are treated as missing sentinels and replaced by the median learned from the corresponding training fold. Zero remains valid for Pregnancies and DiabetesPedigreeFunction. Age is not treated as missing based on zero. The 80/20 test split is stratified and fixed at seed 42; preprocessing and 5-fold stratified model selection use training rows only. Logistic Regression uses balanced class weights; XGBoost uses no oversampling or class reweighting. The selected candidate is the one with the higher mean training-fold ROC-AUC; the test set is evaluated once at a 0.5 cutoff.

The feature importance chart reports model associations (gain for XGBoost or absolute standardized coefficients for Logistic Regression); it does not explain causes. Metrics are dataset-specific and should not be interpreted as evidence of clinical validity or broad generalization.

## Windows PowerShell setup

From `apps/ml-service`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Download and validate the dataset, compare models, evaluate the selected pipeline, and create artifacts:

```powershell
python scripts\download_data.py
python scripts\train.py
```

Run the test suite and start the API:

```powershell
python -m pytest
python -m uvicorn app.main:app --reload
```

OpenAPI docs are at `http://127.0.0.1:8000/docs`. Implemented endpoints:

- `GET /health`
- `GET /model/info`
- `POST /predict`

Example request:

```powershell
$body = @{
  Pregnancies = 2; Glucose = 120; BloodPressure = 70; SkinThickness = 20
  Insulin = 80; BMI = 25.5; DiabetesPedigreeFunction = 0.4; Age = 30
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/predict -ContentType 'application/json' -Body $body
```

Response includes `predicted_class`, `model_probability`, and an educational disclaimer. Probability is the model's output for this dataset, not a personal clinical risk estimate. Inputs are checked against broad plausibility bounds; zero is accepted for SkinThickness and Insulin as source missing-value sentinels, while Glucose, BloodPressure, BMI, and Age must be positive.

There are currently no required environment variables or deployment configuration. Paths are local to this service and model artifacts must be generated before `/model/info` or `/predict` can serve requests.

## Generated files

`data/raw/diabetes.csv` and generated model/evaluation artifacts in `artifacts/` can be recreated with the commands above. These generated data and binary outputs are ignored by Git; source code and instructions remain tracked.
