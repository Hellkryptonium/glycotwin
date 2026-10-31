from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = PROJECT_ROOT / "data" / "raw" / "diabetes.csv"
ARTIFACT_DIR = PROJECT_ROOT / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "glycotwin_model_a_v1.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics_v1.json"
CONFUSION_MATRIX_PATH = ARTIFACT_DIR / "confusion_matrix_v1.png"
FEATURE_IMPORTANCE_PATH = ARTIFACT_DIR / "feature_importance_v1.png"

FEATURES = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin",
    "BMI", "DiabetesPedigreeFunction", "Age",
]
TARGET = "Outcome"
ZERO_AS_MISSING = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
DISCLAIMER = (
    "Educational/research prototype only. This output is not a diagnosis or a "
    "clinically calibrated personal risk estimate. Consult a qualified clinician."
)
