import { Router } from 'express';
import { AssignInput, StatusInput, assignAgentToBug, getBugsForVillage, updateBugStatus } from './service';

export const bugRouter = Router();

// List bugs by village
bugRouter.get('/villages/:villageId/bugs', async (req, res, next) => {
  try {
    const { villageId } = req.params;
    const bugs = await getBugsForVillage(villageId);
    res.json(bugs);
  } catch (err) {
    next(err);
  }
});

// Assign agent
bugRouter.post('/bugs/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = AssignInput.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST' });
    }
    const bug = await assignAgentToBug(id, parsed.data.agentId);
    if (!bug) return res.status(404).json({ error: 'bug not found', code: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Update status
bugRouter.put('/bugs/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = StatusInput.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST' });
    }
    const bug = await updateBugStatus(id, parsed.data.status);
    if (!bug) return res.status(404).json({ error: 'bug not found', code: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

