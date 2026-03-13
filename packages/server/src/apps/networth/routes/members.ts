import { Router, Request, Response } from 'express';
import { getMembers, saveMembers } from '../../../lib/config.js';

const router = Router();

// GET /api/members
router.get('/', (_req: Request, res: Response) => {
  try {
    const config = getMembers();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read family members config' });
  }
});

// PUT /api/members
router.put('/', (req: Request, res: Response) => {
  try {
    const config = req.body;
    if (!config.members || !Array.isArray(config.members)) {
      res.status(400).json({ error: 'Invalid config: members array required' });
      return;
    }
    saveMembers(config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save family members config' });
  }
});

export default router;
