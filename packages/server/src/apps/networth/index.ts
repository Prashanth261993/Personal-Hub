import { Router } from 'express';
import membersRouter from './routes/members.js';
import categoriesRouter from './routes/categories.js';
import snapshotsRouter from './routes/snapshots.js';
import insightsRouter from './routes/insights.js';
import goalsRouter from './routes/goals.js';

const router = Router();

router.use('/members', membersRouter);
router.use('/categories', categoriesRouter);
router.use('/snapshots', snapshotsRouter);
router.use('/insights', insightsRouter);
router.use('/goals', goalsRouter);

export default router;
