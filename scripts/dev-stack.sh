#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Configure model and sandbox credentials before running agent sessions."
fi

bun install
docker compose up -d postgres nats temporal minio minio-init
bun run db:migrate
docker build -f docker/sandbox.Dockerfile -t opengeni-sandbox:local .

pids=()
cleanup() {
  if [ "${#pids[@]}" -gt 0 ]; then
    kill "${pids[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

bun run dev:api &
pids+=("$!")

bun run dev:worker &
pids+=("$!")

bun run dev:web &
pids+=("$!")

wait
exit_code=$?
cleanup
exit "$exit_code"
