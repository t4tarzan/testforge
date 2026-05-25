#!/usr/bin/env bash
# Post-deploy smoke test. Run against any deployed origin (prod or preview):
#   ./scripts/smoke.sh https://testforge.run
#   ./scripts/smoke.sh https://my-preview-xyz.vercel.app
#
# Exit code:
#   0 — all assertions passed
#   1 — at least one assertion failed (CI-friendly)
#
# Checks (all read-only):
#   1. /api/health returns 200 with database:"connected"
#   2. /api/status returns 200 with overall status
#   3. /api/projects without a cookie returns 401 (auth enforced)
#   4. cross-origin request returns 403 (CORS allowlist enforced)
#   5. /api/badge returns SVG with correct content-type
#   6. /api/auth/me without a cookie returns 401 (not 500 — no SESSION_SECRET error)
#   7. /api/analyze rejects a non-GitHub URL with 400

set -uo pipefail

BASE="${1:-${BASE_URL:-https://testforge.run}}"
PASS=0
FAIL=0

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
ok() { echo "  $(color '32' '✓') $1"; PASS=$((PASS + 1)); }
no() { echo "  $(color '31' '✗') $1"; FAIL=$((FAIL + 1)); }

assert_status() {
  local name="$1" url="$2" expected="$3"
  shift 3
  # Pass any remaining positional args through to curl. Empty case is
  # handled with the ${arr[@]+...} idiom because of `set -u`.
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' ${@+"$@"} "$url")
  if [[ "$actual" == "$expected" ]]; then
    ok "$name → $actual"
  else
    no "$name → expected $expected got $actual"
  fi
}

assert_header_contains() {
  local name="$1" url="$2" header="$3" pattern="$4"
  local value
  value=$(curl -s -D - -o /dev/null "$url" | tr -d '\r' | grep -i "^${header}:" | head -1 | sed -E 's/^[^:]+: *//I')
  if [[ "$value" =~ $pattern ]]; then
    ok "$name → ${header}: $value"
  else
    no "$name → ${header} expected /$pattern/ got '$value'"
  fi
}

assert_body_contains() {
  local name="$1" url="$2" pattern="$3"
  local body
  body=$(curl -s "$url")
  if [[ "$body" == *"$pattern"* ]]; then
    ok "$name"
  else
    no "$name → '$pattern' not in body: $(echo "$body" | head -c 120)"
  fi
}

echo
echo "Smoke-testing $BASE"
echo

# 1. Health
assert_status         "/api/health 200"           "$BASE/api/health" 200
assert_body_contains  "/api/health database:ok"   "$BASE/api/health" '"database":"connected"'

# 2. Status
assert_status         "/api/status 200"           "$BASE/api/status" 200

# 3. Authenticated routes refuse without cookie
assert_status         "/api/projects no cookie"   "$BASE/api/projects" 401
assert_status         "/api/auth/me no cookie"    "$BASE/api/auth/me" 401
assert_status         "/api/keys no cookie"       "$BASE/api/keys" 401

# 4. CORS allowlist refuses unknown origin
assert_status         "Cross-origin → 403"        "$BASE/api/projects" 403 \
  -H "Origin: https://evil.example"

# 5. Badge endpoint
assert_header_contains "/api/badge content-type"  "$BASE/api/badge" "content-type" "svg"

# 6. Analyze input validation
assert_status         "/api/analyze bad url 400"  "$BASE/api/analyze" 400 \
  -X POST -H "Content-Type: application/json" -d '{"repoUrl":"not-a-github-url"}'

# 7. Request id header is set on every response
assert_header_contains "X-Request-Id present"     "$BASE/api/health" "x-request-id" '.+'

echo
echo "Passed: $(color '32' "$PASS")   Failed: $(color '31' "$FAIL")"
exit $((FAIL > 0 ? 1 : 0))
