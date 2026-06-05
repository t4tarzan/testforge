# runnable-app fixture

A minimal, zero-dependency, dockerized HTTP server used to exercise the
**`/simulate` real load + chaos path** end-to-end (the branch where
`load.ranReal === true`).

Most public repos can't be auto-booted (no root Dockerfile, or the image
doesn't bind its `EXPOSE` port), so `/simulate` usually lands in the static
fallback. This fixture is purpose-built to boot cleanly:

- root `Dockerfile` → `detectRunnable()` returns `{runnable:true, method:'dockerfile'}`
- `EXPOSE 3000` and `server.listen(3000, '0.0.0.0')` → the health probe answers,
  so autocannon load + chaos actually run against a live container.

## Run it through /simulate

`git clone` needs a real repo, so init a throwaway git repo from this dir and
point `/simulate` at it via a `file://` URL:

```sh
TMP=$(mktemp -d)
cp -r tests/fixtures/runnable-app/* "$TMP"/
git -C "$TMP" init -q && git -C "$TMP" add -A && git -C "$TMP" commit -qm fixture
curl -s -X POST http://127.0.0.1:9990/simulate \
  -H 'content-type: application/json' \
  -d "{\"repoUrl\":\"file://$TMP\"}"
# poll the returned statusUrl until status=done; expect load.ranReal=true
```
