import { Router } from 'express';
import { prisma } from '../db/client';
import { requireAuth } from '../auth/middleware';

export const worldRouter = Router();

// Get a WorldNode by ID (or 'root')
worldRouter.get('/:id', requireAuth, async (req, res, next) => {
    try {
        let id = req.params.id;

        // Helper to find root if requested
        if (id === 'root') {
            const root = await prisma.worldNode.findFirst({
                where: { parentId: null },
            });
            if (!root) return res.status(404).json({ error: 'Root not found' });
            id = root.id;
        }

        const node = await prisma.worldNode.findUnique({
            where: { id },
            include: {
                children: true, // Fetch immediate children for portals
            },
        });

        if (!node) return res.status(404).json({ error: 'Node not found' });

        res.json(node);
    } catch (e) {
        next(e);
    }
});
