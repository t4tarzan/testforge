// Plain JavaScript express app — no TS, no testing framework, no ORM.
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('legacy stack'));
app.listen(0);
