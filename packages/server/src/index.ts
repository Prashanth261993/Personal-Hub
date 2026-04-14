import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/migrate.js';
import networthRouter from './apps/networth/index.js';
import todoRouter from './apps/todo/index.js';
import stocksRouter from './apps/stocks/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

// Run DB migrations on startup
runMigrations();
console.log('Database migrations complete.');

// App Routes
app.use('/api/networth', networthRouter);
app.use('/api/todo', todoRouter);
app.use('/api/stocks', stocksRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Personal Hub server running on http://localhost:${PORT}`);
});
