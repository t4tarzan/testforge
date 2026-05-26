// No CI, no Docker, no Sentry, no flags, no tests, no CODEOWNERS.
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('ok'));
app.listen(0);
