import joblib
import pandas as pd

from app.core.config import FEATURES, MODEL_PATH


def load_model(path=MODEL_PATH):
    if not path.is_file():
        raise FileNotFoundError(f"Model artifact not found at {path}. Run scripts/train.py first.")
    return joblib.load(path)


def predict(artifact, values: dict) -> tuple[int, float]:
    row = pd.DataFrame([{feature: values[feature] for feature in FEATURES}], columns=FEATURES)
    pipeline = artifact["pipeline"]
    probability = float(pipeline.predict_proba(row)[0, 1])
    return int(probability >= 0.5), probability
