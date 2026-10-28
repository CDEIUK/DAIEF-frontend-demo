import subprocess
import sys
import time
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
WORKBOOK_PATH = PROJECT_DIR / "Interactive DAIEF schema (APP).xlsx"
TRANSLATION_SCRIPT = PROJECT_DIR / "json-translation.py"
POLL_INTERVAL_SECONDS = 0.5
STABLE_SECONDS = 1.0


def file_signature(path):
    try:
        stat = path.stat()
    except FileNotFoundError:
        return None
    return stat.st_mtime_ns, stat.st_size


def main():
    observed_signature = file_signature(WORKBOOK_PATH)
    changed_at = None
    print(f"Watching {WORKBOOK_PATH.name}; press Ctrl+C to stop.", flush=True)

    try:
        while True:
            current_signature = file_signature(WORKBOOK_PATH)
            if current_signature != observed_signature:
                observed_signature = current_signature
                changed_at = time.monotonic()

            if (
                current_signature is not None
                and changed_at is not None
                and time.monotonic() - changed_at >= STABLE_SECONDS
            ):
                changed_at = None
                print("Workbook changed; running translation.", flush=True)
                result = subprocess.run(
                    [sys.executable, str(TRANSLATION_SCRIPT)],
                    cwd=PROJECT_DIR,
                    check=False,
                )
                if result.returncode:
                    print(
                        f"Translation exited with status {result.returncode}.",
                        flush=True,
                    )

            time.sleep(POLL_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\nStopped watching.", flush=True)


if __name__ == "__main__":
    main()
