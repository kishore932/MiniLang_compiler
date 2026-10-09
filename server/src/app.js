import express from 'express';
import { compileSource } from './compiler/compile.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'minilang-backend' });
});

app.post('/api/compile', (request, response) => {
  const { source } = request.body ?? {};
  if (typeof source !== 'string') {
    response.status(400).json({ message: 'Request body must include source as a string.' });
    return;
  }

  response.json(compileSource(source));
});

export default app;