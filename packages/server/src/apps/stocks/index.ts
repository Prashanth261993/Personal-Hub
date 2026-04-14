import { Router } from 'express';
import stocksRouter from './routes/stocks.js';

const router = Router();

router.use('/', stocksRouter);

export default router;