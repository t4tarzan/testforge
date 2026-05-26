// USES publicUsed and withLodash but not internalDead / FORGOTTEN_CONSTANT.
import { publicUsed, withLodash } from './used.js';
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.json({ a: publicUsed(1), b: withLodash({ x: 1 }, 'x') });
});

app.listen(0);
