import { Router } from 'express';
import stocksRouter from './routes/stocks.js';
import presetsRouter from './routes/presets.js';

const router = Router();

router.use('/presets', presetsRouter);
router.use('/', stocksRouter);

export default router;