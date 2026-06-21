#!/usr/bin/env bash
#
# Starts the whole Qore_AI system:
#   1. platform              (pnpm dev :3002)  -- recruitment hub (jobs, ATS, dashboards)
#   2. agent-starter-react   (pnpm dev)
#   3. quiz-frontend         (pnpm dev :3001)  -- proctored assessment
#   4. voice-agent           (uv run agent.py dev)  -- uses .venv
#
# Run from anywhere:  ./start.sh
# Stop everything:    Ctrl+C
#
set -euo pipefail

# Resolve repo root (directory this script lives in)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pids=()

cleanup() {
  echo ""
  echo "==> Shutting down all services..."
  for pid in "${pids[@]}"; do
    # Kill the whole process group so child dev servers die too
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "==> Done."
}
trap cleanup EXIT INT TERM

start() {
  local name="$1" dir="$2"; shift 2
  echo "==> Starting $name  ($*)"
  ( cd "$ROOT/$dir" && exec "$@" ) &
  pids+=("$!")
}

# setsid puts each service in its own process group (clean shutdown of children)
start "platform"            "platform"            pnpm dev
start "agent-starter-react" "agent-starter-react" pnpm dev
start "quiz-frontend"       "quiz-frontend"       pnpm dev
start "voice-agent"         "voice-agent"         uv run agent.py dev

echo ""
echo "==> All services launched. Press Ctrl+C to stop everything."
echo ""

# Wait for all background jobs; if any exits, keep the rest running until Ctrl+C
wait
