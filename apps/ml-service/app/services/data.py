from pathlib import Path
import pandas as pd

from app.core.config import FEATURES, TARGET


def load_dataset(path: Path) -> pd.DataFrame:
    if not Path(path).is_file():
        raise FileNotFoundError(f"Dataset not found at {path}. Run scripts/download_data.py first.")
    frame = pd.read_csv(path)
    # The preferred Hugging Face copy currently names the canonical Outcome label `y`.
    if TARGET not in frame.columns and "y" in frame.columns:
        frame = frame.rename(columns={"y": TARGET})
    expected = FEATURES + [TARGET]
    if list(frame.columns) != expected:
        raise ValueError(f"Unexpected dataset columns. Expected {expected}; got {list(frame.columns)}")
    if len(frame) != 768:
        raise ValueError(f"Expected exactly 768 observations; found {len(frame)}")
    if frame.isna().any().any():
        raise ValueError("Raw dataset contains missing values; inspect the downloaded source")
    if not set(frame[TARGET].unique()).issubset({0, 1}) or set(frame[TARGET].unique()) != {0, 1}:
        raise ValueError("Outcome must contain both binary classes 0 and 1")
    return frame
