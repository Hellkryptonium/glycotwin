from pathlib import Path
import sys
from urllib.error import URLError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import DATA_PATH
from app.services.data import load_dataset

URL = "https://huggingface.co/datasets/khoaguin/pima-indians-diabetes-database/resolve/main/diabetes.csv"


def main() -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    request = Request(URL, headers={"User-Agent": "GlycoTwin-Model-A/1.0"})
    try:
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f"Dataset server returned HTTP {response.status}")
            content = response.read()
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not download the specified dataset from {URL}: {exc}") from exc
    # Preserve a failed/unvalidated download outside the expected raw path.
    candidate = DATA_PATH.with_suffix(".csv.tmp")
    candidate.write_bytes(content)
    try:
        load_dataset(candidate)
    except Exception:
        candidate.unlink(missing_ok=True)
        raise
    candidate.replace(DATA_PATH)
    print(f"Validated 768-row Pima dataset saved to {DATA_PATH}")


if __name__ == "__main__":
    main()
