import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from xgboost import XGBClassifier
from sklearn.linear_model import LogisticRegression

from app.core.config import FEATURES, ZERO_AS_MISSING


def _zeros_to_nan(values):
    result = np.asarray(values, dtype=float).copy()
    result[result == 0] = np.nan
    return result


def make_preprocessor(scale: bool = False) -> ColumnTransformer:
    zero_pipeline = Pipeline([
        ("zero_to_missing", FunctionTransformer(_zeros_to_nan, feature_names_out="one-to-one")),
        ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
    ])
    ordinary_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
    ])
    transformers = [
        ("zero_measurements", zero_pipeline, ZERO_AS_MISSING),
        ("other_features", ordinary_pipeline,
         [feature for feature in FEATURES if feature not in ZERO_AS_MISSING]),
    ]
    steps = [("columns", ColumnTransformer(transformers, verbose_feature_names_out=False))]
    if scale:
        steps.append(("scale", StandardScaler()))
    return Pipeline(steps)


def build_models(random_state: int = 42):
    return {
        "logistic_regression": Pipeline([
            ("preprocess", make_preprocessor(scale=True)),
            ("classifier", LogisticRegression(
                max_iter=2000, class_weight="balanced", random_state=random_state
            )),
        ]),
        "xgboost": Pipeline([
            ("preprocess", make_preprocessor()),
            ("classifier", XGBClassifier(
                n_estimators=350, max_depth=3, learning_rate=0.04,
                subsample=0.85, colsample_bytree=0.85, reg_lambda=2.0,
                objective="binary:logistic", eval_metric="logloss",
                random_state=random_state, n_jobs=1,
            )),
        ]),
    }
