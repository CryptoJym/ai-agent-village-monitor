import { FileSystemService } from '../src/filesystem/service';
import { prisma } from '../src/db/client';
import path from 'path';

async function main() {
    const targetDir = path.resolve(__dirname, '../src/filesystem');
    console.log(`Targeting directory: ${targetDir}`);

    const service = new FileSystemService([targetDir]);

    try {
        await service.start();
        console.log('Service started. Waiting for sync...');

        // Wait a bit for async operations
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify DB
        const nodes = await prisma.worldNode.findMany({
            where: { provider: 'filesystem' },
            include: { children: true }
        });

        console.log('--- Verification Results ---');
        console.log(`Found ${nodes.length} filesystem nodes.`);

        // Helper to print tree
        const printNode = (node: any, depth = 0) => {
            const indent = '  '.repeat(depth);
            const layout = node.config?.layout ? ` [x:${node.config.layout.x.toFixed(2)}, y:${node.config.layout.y.toFixed(2)}]` : '';
            const mapData = node.config?.gridSize ? ` [Grid: ${node.config.gridSize}, Walkable: ${node.config.walkable}]` : '';
            const asset = node.assets?.background ? ` [Asset: ${node.assets.background}]` : '';
            console.log(`${indent}- ${node.name} (${node.type})${layout}${mapData}${asset}`);

            if (node.children) {
                for (const child of node.children) {
                    printNode(child, depth + 1);
                }
            }
        };
        const roots = nodes.filter(n => !n.parentId);
        for (const root of roots) {
            printNode(root);
            // Manually fetch children for deep verification if needed, 
            // but 'include: { children: true }' only goes one level deep in Prisma usually unless recursive include is used (which Prisma doesn't support natively well for arbitrary depth without raw query or multiple fetches).
            // For verification, we'll just check the flat list or first level.
        }

        await service.stop();
    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
