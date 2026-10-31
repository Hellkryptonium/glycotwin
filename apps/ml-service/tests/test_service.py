import numpy as np
import pytest
from fastapi import Request
from pydantic import ValidationError

from app.core.config import DATA_PATH, FEATURES
from app.main import app, health, model_info, predict_endpoint
from app.models.pipeline import make_preprocessor
from app.schemas.prediction import PredictionRequest
from app.services.data import load_dataset
from app.services.inference import load_model, predict


def _request(path: str) -> Request:
    return Request({
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "GET", "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "headers": [], "client": ("test", 1),
        "server": ("test", 80), "app": app,
    })


def test_dataset_loading_and_preprocessing():
    frame = load_dataset(DATA_PATH)
    assert frame.shape == (768, 9)
    assert set(frame["Outcome"].unique()) == {0, 1}
    assert frame["Outcome"].value_counts().to_dict() == {0: 500, 1: 268}
    X = frame[FEATURES]
    transformed = make_preprocessor().fit_transform(X)
    assert transformed.shape == (768, 8)
    assert np.isfinite(transformed).all()


def test_model_artifact_loading_and_valid_prediction():
    artifact = load_model()
    assert artifact["version"] == "1.0.0"
    values = {
        "Pregnancies": 2, "Glucose": 120, "BloodPressure": 70,
        "SkinThickness": 20, "Insulin": 80, "BMI": 25.5,
        "DiabetesPedigreeFunction": 0.4, "Age": 30,
    }
    predicted_class, probability = predict(artifact, values)
    assert predicted_class in (0, 1)
    assert 0 <= probability <= 1


def test_rejects_invalid_values():
    payload = {
        "Pregnancies": 2, "Glucose": 0, "BloodPressure": 70,
        "SkinThickness": 20, "Insulin": 80, "BMI": 25.5,
        "DiabetesPedigreeFunction": 0.4, "Age": 30,
    }
    with pytest.raises(ValidationError):
        PredictionRequest(**payload)


def test_health_model_info_and_prediction_endpoints():
    app.state.model_artifact = load_model()
    request = _request("/health")
    assert health(request) == {"status": "ok", "model_loaded": True}
    info = model_info(request)
    assert info.model_name == "logistic_regression"
    assert len(info.features) == 8
    payload = PredictionRequest(**{
        "Pregnancies": 2, "Glucose": 120, "BloodPressure": 70,
        "SkinThickness": 20, "Insulin": 80, "BMI": 25.5,
        "DiabetesPedigreeFunction": 0.4, "Age": 30,
    })
    response = predict_endpoint(payload, request)
    assert response.predicted_class in (0, 1)
    assert 0 <= response.model_probability <= 1
    assert "Educational/research" in response.disclaimer
