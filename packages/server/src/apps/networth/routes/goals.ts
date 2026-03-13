import { Router, Request, Response } from 'express';
import { getGoals, saveGoals } from '../../../lib/config.js';

const router = Router();

// GET /api/goals
router.get('/', (_req: Request, res: Response) => {
  try {
    const config = getGoals();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read goals config' });
  }
});

// PUT /api/goals
router.put('/', (req: Request, res: Response) => {
  try {
    const config = req.body;
    if (!config.goals || !Array.isArray(config.goals)) {
      res.status(400).json({ error: 'Invalid config: goals array required' });
      return;
    }
    saveGoals(config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save goals config' });
  }
});

export default router;
