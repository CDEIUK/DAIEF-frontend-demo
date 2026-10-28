#!/bin/bash

set -u

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || exit 1

IS_CODESPACES="${CODESPACES:-false}"
VITE_HOST="127.0.0.1"

if [[ "$IS_CODESPACES" == "true" ]]; then
  VITE_HOST="0.0.0.0"
fi

for required_command in node npm python3 curl; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$required_command"
    if [[ "$required_command" == "node" || "$required_command" == "npm" ]]; then
      echo "Install Node.js, then double-click this launcher again."
    else
      echo "Install the missing command, then double-click this launcher again."
    fi
    read -r -p "Press Return to close this window."
    exit 1
  fi
done

if [[ ! -f "Interactive DAIEF schema (APP).xlsx" ]]; then
  echo "Could not find Interactive DAIEF schema (APP).xlsx in:"
  echo "$PROJECT_DIR"
  read -r -p "Press Return to close this window."
  exit 1
fi

if [[ ! -x "node_modules/.bin/vite" ]]; then
  echo "Installing the project's JavaScript dependencies..."
  if ! npm ci; then
    echo "Dependency installation failed."
    read -r -p "Press Return to close this window."
    exit 1
  fi
fi

echo "Generating the survey from the current workbook..."
if ! python3 json-translation.py; then
  echo "Survey generation failed."
  read -r -p "Press Return to close this window."
  exit 1
fi

VITE_PID=""
WATCHER_PID=""

cleanup() {
  if [[ -n "$WATCHER_PID" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
    wait "$WATCHER_PID" 2>/dev/null || true
  fi
  if [[ -n "$VITE_PID" ]]; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm run dev -- --host "$VITE_HOST" --strictPort &
VITE_PID=$!
python3 watch-schema.py &
WATCHER_PID=$!

PREVIEW_URL="http://127.0.0.1:5173/"
READY=0
for ((attempt = 0; attempt < 60; attempt++)); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "The local preview server stopped before it was ready."
    exit 1
  fi
  if curl --silent --fail "$PREVIEW_URL" >/dev/null; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "$READY" -ne 1 ]]; then
  echo "The local preview did not start at $PREVIEW_URL."
  exit 1
fi

if [[ "$IS_CODESPACES" == "true" ]]; then
  if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
    echo "Preview: https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  else
    echo "Preview server is running on port 5173."
    echo "Open port 5173 from the Codespaces Ports tab."
  fi
else
  echo "Preview is open at $PREVIEW_URL"
  open "$PREVIEW_URL" || echo "Open this URL in your browser: $PREVIEW_URL"
fi

echo "Save the workbook to regenerate the survey. Press Ctrl+C to stop."

wait "$VITE_PID"
