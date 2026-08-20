#!/usr/bin/env bash
# Spins up a throwaway Postgres container, migrates it, runs the backend test
# suite against it, then tears the container down -- win or lose.
set -uo pipefail

CONTAINER_NAME="blylinks-test-pg"
TEST_PORT="55499"
export DATABASE_URL="postgres://postgres:postgres@localhost:${TEST_PORT}/blylinks_test"
export JWT_SECRET="test-secret-not-for-production"
export APP_ENV="test"
export LOG_LEVEL="info"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
}
trap cleanup EXIT

echo "== starting throwaway test postgres =="
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=blylinks_test \
  -p "${TEST_PORT}:5432" postgres:16-alpine >/dev/null

echo "== waiting for postgres to accept connections =="
for i in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
# pg_isready can report ready a moment before the server actually accepts
# external TCP connections -- give it a beat, then retry the migration itself
# a few times rather than aborting on the first transient connection error.
sleep 2

echo "== running migrations =="
MIGRATED=0
for attempt in 1 2 3 4 5; do
  if npm run migrate; then
    MIGRATED=1
    break
  fi
  echo "migration attempt $attempt failed, retrying in 2s..."
  sleep 2
done
if [ "$MIGRATED" -ne 1 ]; then
  echo "migrations failed after retries, aborting"
  exit 1
fi

echo "== running server test suite =="
# 01-auth.test.js asserts the users table is genuinely empty (bootstrap semantics),
# which only holds before any other file has inserted a user. Vitest does not
# guarantee alphabetical file order even with fileParallelism off, so run it
# alone first, then everything else explicitly listed (never a bare "server"
# glob for the second pass, or it would pick 01-auth back up post-bootstrap).
npx vitest run server/test/01-auth.test.js
AUTH_STATUS=$?

npx vitest run \
  server/test/00-health.test.js \
  server/test/02-users.test.js \
  server/test/03-campaigns.test.js \
  server/test/04-sales.test.js \
  server/test/05-attendance.test.js \
  server/test/06-payroll.test.js \
  server/test/07-message-groups.test.js
REST_STATUS=$?

if [ "$AUTH_STATUS" -ne 0 ] || [ "$REST_STATUS" -ne 0 ]; then
  exit 1
fi
exit 0
