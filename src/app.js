import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import routes from './routes/index.js';
import { errorHandler } from './common/middlewares/errorHandler.js';
import { notFoundHandler } from './common/middlewares/notFound.js';
import { config } from './config/env.js';

const app = express();
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../public');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', routes);

app.get('/api', (req, res) => {
  res.json({ name: 'survey-system', version: '1.0.0', status: 'running' });
});

app.use(express.static(publicDir, { index: 'index.html', extensions: ['html'] }));

app.get(/^\/(?!api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
