"""Download official NHANES 2017-2018 XPT modules used by this experiment."""

from __future__ import annotations

import argparse
import os
import time
import urllib.error
import urllib.request
from pathlib import Path


BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles"
MODULES = (
    "DEMO_J", "DIQ_J", "BMX_J", "BPX_J", "GHB_J", "GLU_J",
    "PAQ_J", "DR1TOT_J", "DR2TOT_J", "SLQ_J",
)


def download_module(name: str, destination: Path, retries: int = 3) -> Path:
    if name not in MODULES:
        raise ValueError(f"Unsupported NHANES module: {name}")
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f"{name}.XPT"
    if target.exists() and target.stat().st_size > 0:
        return target
    partial = target.with_suffix(".XPT.part")
    url = f"{BASE_URL}/{name}.XPT"
    headers = {"User-Agent": "GlycoTwin-NHANES-research/1.0"}
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=90) as response, partial.open("wb") as output:
                if response.status != 200:
                    raise OSError(f"CDC returned HTTP {response.status} for {url}")
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if partial.stat().st_size < 1024:
                raise OSError(f"Downloaded file is unexpectedly small: {partial.stat().st_size} bytes")
            os.replace(partial, target)
            return target
        except (OSError, urllib.error.URLError) as exc:
            last_error = exc
            partial.unlink(missing_ok=True)
            if attempt + 1 < retries:
                time.sleep(2**attempt)
    raise RuntimeError(f"Failed to download {url}: {last_error}") from last_error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).parent / "data" / "raw")
    parser.add_argument("--force", action="store_true", help="Replace existing files")
    args = parser.parse_args()
    for module in MODULES:
        target = args.data_dir / f"{module}.XPT"
        if args.force:
            target.unlink(missing_ok=True)
        path = download_module(module, args.data_dir)
        print(f"{module}: {path.stat().st_size:,} bytes -> {path}")


if __name__ == "__main__":
    main()
