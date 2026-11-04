import { Router } from 'express';
import { createBackup, getBackupStatus } from '../lib/backup.js';

const router = Router();

router.get('/backup/status', (_req, res) => {
  try {
    res.json(getBackupStatus());
  } catch (err) {
    console.error('Failed to read backup status:', err);
    res.status(500).json({ error: 'Failed to read backup status' });
  }
});

router.post('/backup', async (req, res) => {
  try {
    const upload = req.body?.upload !== false;
    const result = await createBackup({ reason: 'manual', upload });
    res.json(result);
  } catch (err) {
    console.error('Backup failed:', err);
    res.status(500).json({ error: (err as Error).message || 'Backup failed' });
  }
});

export default router;
