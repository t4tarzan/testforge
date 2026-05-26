// FIXTURE — Express server with a mix of documented + undocumented routes.

const express = require('express');
const app = express();

// Documented in openapi.yaml as GET /v1/users (matches).
app.get('/v1/users', (req, res) => res.json([]));

// Documented as GET /v1/users/{id} — should match via canonicalPath.
app.get('/v1/users/:id', (req, res) => res.json({ id: req.params.id }));

// UNDOCUMENTED — exists in code but not in the spec.
app.post('/v1/users', (req, res) => res.json({ created: true }));

// UNDOCUMENTED — same.
app.get('/v1/admin/audit-log', (req, res) => res.json({ entries: [] }));

app.listen(0);
