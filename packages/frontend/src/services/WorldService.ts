import { WorldNode } from '../world/types';

export class WorldService {
    static async getWorldNode(id: string): Promise<WorldNode> {
        const res = await fetch(`/api/world/${encodeURIComponent(id)}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch world node ${id}: ${res.statusText}`);
        }
        return res.json();
    }

    static async getRootNode(): Promise<WorldNode> {
        return this.getWorldNode('root');
    }
}
