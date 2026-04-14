import { Router } from 'express';
import stocksRouter from './routes/stocks.js';
import presetsRouter from './routes/presets.js';
import agentRouter from './routes/agent.js';

const router = Router();

router.use('/agent', agentRouter);
router.use('/presets', presetsRouter);
router.use('/', stocksRouter);

export default router;