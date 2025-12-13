import { WorldNode } from '@prisma/client';

export interface LayoutNode {
    id: string;
    x: number;
    y: number;
    r: number; // Radius (0.0 - 1.0 relative to parent)
}

/**
 * Simple Circle Packing Layout
 * Places nodes in a spiral pattern for now.
 * In a real implementation, we'd use a physics simulation or d3-hierarchy.
 */
export function calculateLayout(children: WorldNode[]): Map<string, LayoutNode> {
    const layout = new Map<string, LayoutNode>();
    const count = children.length;

    if (count === 0) return layout;

    // Simple spiral packing
    // Center the first one? Or spiral all?
    // Let's try a phyllotaxis spiral (sunflower pattern)

    const scaling = 0.8 / Math.sqrt(count); // Scale down as count increases
    const c = 0.1; // Spread factor

    children.forEach((child, i) => {
        // Angle and radius for spiral
        const angle = i * 137.5 * (Math.PI / 180); // Golden angle
        const r = c * Math.sqrt(i);

        const x = r * Math.cos(angle) + 0.5; // Center at 0.5, 0.5
        const y = r * Math.sin(angle) + 0.5;

        // Size depends on... maybe file size? For now uniform.
        const size = scaling * (0.8 + Math.random() * 0.4); // Random variation

        layout.set(child.id, {
            id: child.id,
            x,
            y,
            r: size / 2,
        });
    });

    return layout;
}
