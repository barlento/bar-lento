#!/usr/bin/env bash
# Runs the local end-to-end suites against the fake dev server (fake Redis, fake Toast, mail captured at /__mail).
# Needs Playwright + Chromium (NODE_PATH=/opt/node22/lib/node_modules in the Claude environment).
set -u
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
(fuser -k 4173/tcp >/dev/null 2>&1 || true); sleep 1
node devserver.js > out.devserver.log 2>&1 &
DEV=$!; sleep 2
status=0
for t in ui docs rules mail it punch sync backfill presence; do
  echo "=== $t"
  if ! timeout 300 node "tests/$t.test.js" 2>&1 | grep -v 'Failed to load resource\|fonts.googleapis' | tail -3; then status=1; fi
done
kill $DEV >/dev/null 2>&1
exit $status
