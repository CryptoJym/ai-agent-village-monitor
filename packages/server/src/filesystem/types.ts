export type FileSystemConfig = {
  rootPaths: string[];
  ignorePatterns?: string[];
};

export type FileSystemNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt: Date;
};

export interface IFileSystemScanner {
  scan(path: string): Promise<FileSystemNode[]>;
}

export interface IFileSystemWatcher {
  watch(paths: string[]): void;
  on(event: 'add' | 'change' | 'unlink', callback: (path: string) => void): void;
  close(): Promise<void>;
}
