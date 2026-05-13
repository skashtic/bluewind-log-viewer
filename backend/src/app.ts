import express from 'express';
import logsController from './logs/logs.controller';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found-handler';

const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/logs', logsController);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
