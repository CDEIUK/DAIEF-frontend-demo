#!/bin/bash

set -u

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required command: python3"
  echo "Install Python 3, then double-click this launcher again."
  read -r -p "Press Return to close this window."
  exit 1
fi

if [[ ! -f "form-content.yaml" ]]; then
  echo "Could not find form-content.yaml in:"
  echo "$PROJECT_DIR"
  read -r -p "Press Return to close this window."
  exit 1
fi

if ! python3 -c "import yaml" >/dev/null 2>&1; then
  echo "The Python YAML dependency is not installed."
  echo "Run: python3 -m pip install -r requirements.txt"
  read -r -p "Press Return to close this window."
  exit 1
fi

exec python3 watch-schema.py
