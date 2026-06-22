import { Router, Request, Response } from 'express';
import type { FundScreenerPreset } from '@networth/shared';
import { getFundScreenerPresets, saveFundScreenerPresets } from '../../../lib/config.js';

const router = Router();

// GET /api/funds/presets
router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(getFundScreenerPresets().presets);
  } catch (err) {
    console.error('Error fetching fund presets:', err);
    res.status(500).json({ error: 'Failed to fetch fund presets' });
  }
});

// POST /api/funds/presets
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Omit<FundScreenerPreset, 'id' | 'createdAt' | 'builtIn'>;
    if (!body.label?.trim()) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const config = getFundScreenerPresets();
    const preset: FundScreenerPreset = {
      id: `preset-${Date.now()}`,
      label: body.label.trim(),
      description: body.description?.trim() || '',
      builtIn: false,
      filters: body.filters ?? {},
      sortKey: body.sortKey || 'fundCount',
      createdAt: new Date().toISOString(),
    };

    config.presets.push(preset);
    saveFundScreenerPresets(config);
    res.status(201).json(preset);
  } catch (err) {
    console.error('Error creating fund preset:', err);
    res.status(500).json({ error: 'Failed to create fund preset' });
  }
});

// PUT /api/funds/presets/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const config = getFundScreenerPresets();
    const index = config.presets.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    if (config.presets[index].builtIn) {
      res.status(400).json({ error: 'Built-in presets cannot be edited' });
      return;
    }

    const existing = config.presets[index];
    const body = req.body as Partial<FundScreenerPreset>;
    config.presets[index] = {
      ...existing,
      label: body.label?.trim() || existing.label,
      description: body.description !== undefined ? body.description.trim() : existing.description,
      filters: body.filters ?? existing.filters,
      sortKey: body.sortKey || existing.sortKey,
    };

    saveFundScreenerPresets(config);
    res.json(config.presets[index]);
  } catch (err) {
    console.error('Error updating fund preset:', err);
    res.status(500).json({ error: 'Failed to update fund preset' });
  }
});

// DELETE /api/funds/presets/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const config = getFundScreenerPresets();
    const index = config.presets.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    if (config.presets[index].builtIn) {
      res.status(400).json({ error: 'Built-in presets cannot be deleted' });
      return;
    }

    config.presets.splice(index, 1);
    saveFundScreenerPresets(config);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting fund preset:', err);
    res.status(500).json({ error: 'Failed to delete fund preset' });
  }
});

export default router;
