import { Router } from 'express';
import fundsRouter from './routes/funds.js';
import insightsRouter from './routes/insights.js';
import mappingsRouter from './routes/mappings.js';
import presetsRouter from './routes/presets.js';
import screenerRouter from './routes/screener.js';

const router = Router();

// Mount fixed-path routers first so their paths are not captured by the funds /:id route.
router.use('/presets', presetsRouter);
router.use('/', screenerRouter);
router.use('/', insightsRouter);
router.use('/', mappingsRouter);
router.use('/', fundsRouter);

export default router;
