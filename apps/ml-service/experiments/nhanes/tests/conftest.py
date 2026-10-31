from __future__ import annotations

import os
import sys
from pathlib import Path

EXPERIMENT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EXPERIMENT))
os.environ.setdefault("MPLCONFIGDIR", str(EXPERIMENT / "artifacts" / ".matplotlib"))
