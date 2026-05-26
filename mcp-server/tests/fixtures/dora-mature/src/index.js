const express = require('express');
const Sentry = require('@sentry/node');
const pino = require('pino');
const { PostHog } = require('posthog-node');

const logger = pino();
const ph = new PostHog('test-key');
Sentry.init({ dsn: 'https://example@sentry.io/123' });

const app = express();
app.get('/', (req, res) => res.send('ok'));
app.listen(0);
