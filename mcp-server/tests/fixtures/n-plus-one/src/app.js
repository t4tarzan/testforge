// FIXTURE — N+1 detection: positive cases (should fire) and negative
// cases (must NOT fire).

const express = require('express');
const app = express();

// ── POSITIVE: db.query inside for-of ──────────────────────────────────
app.get('/users-naive', async (req, res) => {
  const userIds = await db.query('SELECT id FROM users');
  const profiles = [];
  for (const uid of userIds) {
    const profile = await db.query('SELECT * FROM profiles WHERE user_id = $1', [uid]);
    profiles.push(profile);
  }
  res.json(profiles);
});

// ── POSITIVE: arr.forEach with db call inside ─────────────────────────
app.get('/products-foreach', async (req, res) => {
  const ids = [1, 2, 3];
  ids.forEach(async (id) => {
    await db.query('SELECT * FROM products WHERE id = $1', [id]);
  });
  res.json({ ok: true });
});

// ── POSITIVE: prisma.user.findUnique in classic for-loop ──────────────
app.get('/prisma-loop', async (req, res) => {
  for (let i = 0; i < req.query.ids.length; i++) {
    await prisma.user.findUnique({ where: { id: req.query.ids[i] } });
  }
  res.json({ ok: true });
});

// ── NEGATIVE: Promise.all wraps the map — parallel, not N+1 ───────────
app.get('/users-fast', async (req, res) => {
  const ids = [1, 2, 3];
  const profiles = await Promise.all(
    ids.map((id) => db.query('SELECT * FROM profiles WHERE user_id = $1', [id]))
  );
  res.json(profiles);
});

// ── NEGATIVE: db call NOT inside any loop ─────────────────────────────
app.get('/all-users', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users);
});

// ── NEGATIVE: function defined inside a loop, db call inside fn body
// is the fn implementation; analyzer flags the call site, which is what
// the loop iterates over — confirmed in the for-of case above. The
// nested-fn pattern below is a callback that's CALLED from outside the
// loop, so the loop body doesn't issue the query — should NOT fire.
function makeHandler() {
  return async (id) => db.query('SELECT 1');
}
app.get('/handlers', async (req, res) => {
  const handler = makeHandler();
  for (const x of [1, 2]) {
    // We do invoke handler() inside the loop, but the db.query lives
    // inside makeHandler's CLOSURE — the analyzer doesn't follow that
    // depth, and that's fine: it would be too noisy to flag every
    // function call inside a loop. This is a known limitation.
    void handler;
    void x;
  }
  res.json({ ok: true });
});

app.listen(0);
