import fs from 'fs/promises';
import path from 'path';
import { FileSystemNode, IFileSystemScanner } from './types';

export class FileSystemScanner implements IFileSystemScanner {
    async scan(dirPath: string): Promise<FileSystemNode[]> {
        const nodes: FileSystemNode[] = [];
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue; // Skip dotfiles for now

                const fullPath = path.join(dirPath, entry.name);
                const stats = await fs.stat(fullPath);

                nodes.push({
                    name: entry.name,
                    path: fullPath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    updatedAt: stats.mtime,
                });
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
        return nodes;
    }
}
