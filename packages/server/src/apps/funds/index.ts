import { Router } from 'express';
import fundsRouter from './routes/funds.js';
import screenerRouter from './routes/screener.js';

const router = Router();

// Mount screener first so GET /screener is not captured by the funds /:id route.
router.use('/', screenerRouter);
router.use('/', fundsRouter);

export default router;
