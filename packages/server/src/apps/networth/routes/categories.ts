import { Router, Request, Response } from 'express';
import { getCategories, saveCategories } from '../../../lib/config.js';

const router = Router();

// GET /api/categories
router.get('/', (_req: Request, res: Response) => {
  try {
    const config = getCategories();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read categories config' });
  }
});

// PUT /api/categories
router.put('/', (req: Request, res: Response) => {
  try {
    const config = req.body;
    if (!config.assetCategories || !config.liabilityCategories) {
      res.status(400).json({ error: 'Invalid config: assetCategories and liabilityCategories required' });
      return;
    }
    saveCategories(config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save categories config' });
  }
});

export default router;
