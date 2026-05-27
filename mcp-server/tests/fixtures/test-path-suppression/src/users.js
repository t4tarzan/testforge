// Production code — same SQL-concat pattern as the test files below.
// Must still emit a security finding.
import express from 'express';

const app = express();

app.get('/user/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM users WHERE id = ' + id;
  db.query(sql).then((rows) => res.json(rows));
});

export { app };
