// FIXTURE — verifies inline suppression comments silence findings.
const fs = require('fs');
const app = require('express')();

// Line-scoped suppression
app.get('/read', (req, res) => {
  // testforge-disable-next-line path-traversal
  fs.readFile('./files/' + req.query.name, (e, buf) => res.send(buf));
});

// Category-scoped: only suppress one category, the others still fire
app.post('/exec', (req, res) => {
  // testforge-disable-next-line dangerous-functions
  // (we expect the dangerous-functions finding suppressed, but if the
  // analyzer ever adds a separate "command-injection" finding it should
  // still fire here)
  require('child_process').execSync('ls ' + req.body.dir);
  res.send('ok');
});

app.listen(0);
