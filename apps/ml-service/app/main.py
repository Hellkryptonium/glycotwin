from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request

from app.core.config import DISCLAIMER, FEATURES
from app.schemas.prediction import ModelInfoResponse, PredictionRequest, PredictionResponse
from app.services.inference import load_model, predict


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model_artifact = load_model()
    yield


app = FastAPI(
    title="GlycoTwin Model A",
    description="Educational Pima dataset classification prototype; not a clinical tool.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health(request: Request):
    return {"status": "ok", "model_loaded": hasattr(request.app.state, "model_artifact")}


@app.get("/model/info", response_model=ModelInfoResponse)
def model_info(request: Request):
    artifact = getattr(request.app.state, "model_artifact", None)
    if artifact is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    return ModelInfoResponse(
        model_name=artifact["model_name"], version=artifact["version"], features=FEATURES,
        description="Educational binary classifier. Feature importance is association, not causation.",
    )


@app.post("/predict", response_model=PredictionResponse)
def predict_endpoint(payload: PredictionRequest, request: Request):
    artifact = getattr(request.app.state, "model_artifact", None)
    if artifact is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    predicted_class, probability = predict(artifact, payload.model_dump())
    return PredictionResponse(
        predicted_class=predicted_class, model_probability=probability, disclaimer=DISCLAIMER
    )
