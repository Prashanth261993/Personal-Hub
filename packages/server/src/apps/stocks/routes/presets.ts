import { Router, Request, Response } from 'express';
import type { StockPreset } from '@networth/shared';
import { getStockPresets, saveStockPresets } from '../../../lib/config.js';

const router = Router();

// GET /api/stocks/presets
router.get('/', (_req: Request, res: Response) => {
  try {
    const config = getStockPresets();
    res.json(config.presets);
  } catch (err) {
    console.error('Error fetching stock presets:', err);
    res.status(500).json({ error: 'Failed to fetch stock presets' });
  }
});

// POST /api/stocks/presets
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Omit<StockPreset, 'id' | 'createdAt' | 'builtIn'>;

    if (!body.label?.trim()) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const config = getStockPresets();
    const preset: StockPreset = {
      id: `preset-${Date.now()}`,
      label: body.label.trim(),
      description: body.description?.trim() || '',
      builtIn: false,
      filters: body.filters ?? {},
      createdAt: new Date().toISOString(),
    };

    config.presets.push(preset);
    saveStockPresets(config);
    res.status(201).json(preset);
  } catch (err) {
    console.error('Error creating stock preset:', err);
    res.status(500).json({ error: 'Failed to create stock preset' });
  }
});

// PUT /api/stocks/presets/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const config = getStockPresets();
    const index = config.presets.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    const existing = config.presets[index];
    const body = req.body as Partial<StockPreset>;

    config.presets[index] = {
      ...existing,
      label: body.label?.trim() || existing.label,
      description: body.description !== undefined ? body.description.trim() : existing.description,
      filters: body.filters ?? existing.filters,
    };

    saveStockPresets(config);
    res.json(config.presets[index]);
  } catch (err) {
    console.error('Error updating stock preset:', err);
    res.status(500).json({ error: 'Failed to update stock preset' });
  }
});

// DELETE /api/stocks/presets/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const config = getStockPresets();
    const index = config.presets.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    config.presets.splice(index, 1);
    saveStockPresets(config);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting stock preset:', err);
    res.status(500).json({ error: 'Failed to delete stock preset' });
  }
});

export default router;
