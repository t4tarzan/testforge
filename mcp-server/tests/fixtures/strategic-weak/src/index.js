// Stub server. README promises features that aren't built yet.
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('coming soon'));
app.listen(0);
