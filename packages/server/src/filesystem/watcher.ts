import chokidar, { FSWatcher } from 'chokidar';
import { IFileSystemWatcher } from './types';
import { EventEmitter } from 'events';

export class FileSystemWatcher extends EventEmitter implements IFileSystemWatcher {
    private watcher: FSWatcher | null = null;

    watch(paths: string[]) {
        if (this.watcher) {
            this.watcher.add(paths);
        } else {
            this.watcher = chokidar.watch(paths, {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true,
                ignoreInitial: true,
            });

            this.watcher
                .on('add', (path: string) => this.emit('change', 'add', path))
                .on('change', (path: string) => this.emit('change', 'change', path))
                .on('unlink', (path: string) => this.emit('change', 'unlink', path))
                .on('addDir', (path: string) => this.emit('change', 'addDir', path))
                .on('unlinkDir', (path: string) => this.emit('change', 'unlinkDir', path));
        }
    }

    async close() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
