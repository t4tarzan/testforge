// FIXTURE — many endpoints, no OpenAPI spec at all.
const express = require('express');
const app = express();

app.get('/users', (req, res) => res.json([]));
app.post('/users', (req, res) => res.json({}));
app.get('/users/:id', (req, res) => res.json({}));
app.put('/users/:id', (req, res) => res.json({}));
app.delete('/users/:id', (req, res) => res.json({}));
app.get('/orders', (req, res) => res.json([]));
app.post('/orders', (req, res) => res.json({}));
app.get('/orders/:id', (req, res) => res.json({}));

app.listen(0);
