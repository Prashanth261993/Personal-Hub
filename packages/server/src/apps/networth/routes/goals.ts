import { Router, Request, Response } from 'express';
import type { Goal } from '@networth/shared';
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

    for (const goal of config.goals as Goal[]) {
      if (!goal.name || typeof goal.targetValue !== 'number') {
        res.status(400).json({ error: 'Each goal requires a name and numeric targetValue' });
        return;
      }
      if (goal.targetType === 'category' && !goal.categoryId) {
        res.status(400).json({ error: 'Category goals require a categoryId' });
        return;
      }
    }

    saveGoals(config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save goals config' });
  }
});

export default router;
