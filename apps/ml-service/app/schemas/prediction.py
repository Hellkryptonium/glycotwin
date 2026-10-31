from pydantic import BaseModel, ConfigDict, Field


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Pregnancies: int = Field(ge=0, le=20)
    Glucose: float = Field(gt=0, le=300)
    BloodPressure: float = Field(gt=0, le=200)
    SkinThickness: float = Field(ge=0, le=100)
    Insulin: float = Field(ge=0, le=1000)
    BMI: float = Field(gt=0, le=100)
    DiabetesPedigreeFunction: float = Field(ge=0, le=3)
    Age: int = Field(ge=1, le=120)


class PredictionResponse(BaseModel):
    predicted_class: int
    model_probability: float
    disclaimer: str


class ModelInfoResponse(BaseModel):
    model_name: str
    version: str
    features: list[str]
    description: str
