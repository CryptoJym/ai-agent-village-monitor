import { prisma } from '../db/client';
import { FileSystemScanner } from './scanner';
import { FileSystemWatcher } from './watcher';
import path from 'path';

export class FileSystemService {
  private scanner: FileSystemScanner;
  private watcher: FileSystemWatcher;
  private rootPaths: string[];

  constructor(rootPaths: string[]) {
    this.rootPaths = rootPaths;
    this.scanner = new FileSystemScanner();
    this.watcher = new FileSystemWatcher();
  }

  async start() {
    console.log('Starting File System Service...');

    // Initial Scan
    for (const rootPath of this.rootPaths) {
      await this.syncRoot(rootPath);
    }

    // Start Watcher
    this.watcher.watch(this.rootPaths);
    this.watcher.on('change', async (type, changedPath) => {
      console.log(`File system change detected: ${type} ${changedPath}`);
      // Simple strategy: re-sync the parent village of the changed path
      // In a real app, we'd be more granular.
      // Check if this parentDir corresponds to a Village or House and sync accordingly
      // For now, let's just re-sync the root that contains this path
      const root = this.rootPaths.find((r) => changedPath.startsWith(r));
      if (root) {
        await this.syncRoot(root);
      }
    });
  }

  async stop() {
    await this.watcher.close();
  }

  private async syncRoot(rootPath: string) {
    const dirName = path.basename(rootPath);
    console.log(`Syncing root: ${rootPath} as WorldNode (VILLAGE)`);

    // 1. Create/Update Root Node
    const { nanoBanana } = require('../services/nanobanana');
    const prompt = `A sprawling village representing the folder ${dirName}`;
    const assetUrl = await nanoBanana.generateAsset(prompt);

    const rootNode = await prisma.worldNode.upsert({
      where: {
        provider_externalId: {
          provider: 'filesystem',
          externalId: rootPath,
        },
      },
      update: {},
      create: {
        name: dirName,
        type: 'VILLAGE',
        provider: 'filesystem',
        externalId: rootPath,
        visualContext: { prompt },
        assets: { background: assetUrl },
      },
    });

    // 2. Recursively Scan
    await this.syncChildren(rootNode.id, rootPath);
  }

  private async syncChildren(parentId: string, parentPath: string) {
    const nodes = await this.scanner.scan(parentPath);
    const children: any[] = []; // Keep track of synced nodes

    for (const node of nodes) {
      if (node.type === 'directory') {
        const child = await this.syncNode(parentId, node.path, node.name);
        if (child) children.push(child);
      }
    }

    // Apply Layout
    if (children.length > 0) {
      const { calculateLayout } = require('../world/layout');
      const layoutMap = calculateLayout(children);

      for (const child of children) {
        const layout = layoutMap.get(child.id);
        if (layout) {
          await prisma.worldNode.update({
            where: { id: child.id },
            data: {
              config: {
                ...(child.config as object),
                layout: { x: layout.x, y: layout.y, r: layout.r },
              },
            },
          });
        }
      }
    }
  }

  private async syncNode(parentId: string, nodePath: string, nodeName: string) {
    console.log(`Syncing node: ${nodeName}`);

    // Smarter Type Inference
    const type = await this.inferType(nodePath);

    // Check for existing node to avoid re-generation
    const existingNode = await prisma.worldNode.findUnique({
      where: {
        provider_externalId: {
          provider: 'filesystem',
          externalId: nodePath,
        },
      },
    });

    let assetUrl = (existingNode?.assets as Record<string, unknown>)?.['background'];
    let prompt = (existingNode?.visualContext as Record<string, unknown>)?.['prompt'];

    // Lazy Generation: Only generate if missing
    if (!assetUrl) {
      const { nanoBanana } = require('../services/nanobanana');

      let context = 'folder';
      if (type === 'HOUSE') context = 'project';
      else if (type === 'DUNGEON') context = 'dangerous testing ground';
      else if (type === 'ROOM') {
        // Check for specific room vibes
        const fs = require('fs/promises');
        try {
          const files = await fs.readdir(nodePath);
          if (files.includes('docker-compose.yml')) context = 'industrial machine room';
          else if (files.includes('tsconfig.json')) context = 'library';
          else context = 'module';
        } catch {
          /* ignore */
        }
      }

      prompt = `A ${type.toLowerCase()} representing the ${context} ${nodeName}`;
      // In a real app, we might mark this as 'pending' and let a background worker handle it
      // For now, we'll still await it but only on first creation
      assetUrl = await nanoBanana.generateAsset(prompt);
    } else {
      console.log(`[Cache] Using existing asset for ${nodeName}`);
    }

    const worldNode = await prisma.worldNode.upsert({
      where: {
        provider_externalId: {
          provider: 'filesystem',
          externalId: nodePath,
        },
      },
      update: {
        parentId,
        type, // Update type if it changed
      },
      create: {
        parentId,
        name: nodeName,
        type,
        provider: 'filesystem',
        externalId: nodePath,
        visualContext: { prompt: prompt as string },
        assets: { background: assetUrl as string },
        config: {
          gridSize: 32, // Standard RPG tile size
          walkable: true,
          spawnPoint: { x: 10, y: 10 }, // Default spawn in grid coordinates
        },
      },
    });

    // Recurse!
    await this.syncChildren(worldNode.id, nodePath);
    return worldNode;
  }

  private async inferType(nodePath: string): Promise<'VILLAGE' | 'HOUSE' | 'ROOM' | 'DUNGEON'> {
    const fs = require('fs/promises');
    const path = require('path');
    const dirName = path.basename(nodePath);

    try {
      const files = await fs.readdir(nodePath);

      // Heuristics

      // 1. HOUSE: It's a project/repo
      if (
        files.includes('package.json') ||
        files.includes('go.mod') ||
        files.includes('requirements.txt')
      ) {
        return 'HOUSE';
      }

      // 2. DUNGEON: It's where the monsters (bugs) live!
      if (
        dirName === 'tests' ||
        dirName === '__tests__' ||
        dirName === 'spec' ||
        dirName === 'e2e'
      ) {
        return 'DUNGEON';
      }

      // 3. ROOM: Default, but we can refine the prompt later
      // e.g. if files.includes('docker-compose.yml'), prompt = "Industrial machine room"
    } catch {
      /* ignore */
    }
    return 'ROOM'; // Default subfolder
  }
}
