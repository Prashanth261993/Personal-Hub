import { Router } from 'express';
import groupsRouter from './routes/groups.js';
import todosRouter from './routes/todos.js';
import statsRouter from './routes/stats.js';

const router = Router();

router.use('/groups', groupsRouter);
router.use('/todos', todosRouter);
router.use('/stats', statsRouter);

export default router;
