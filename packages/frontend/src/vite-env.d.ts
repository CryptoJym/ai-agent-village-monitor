/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITEST?: string;
  readonly VITEST_WORKER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global process.env for test environments
declare namespace NodeJS {
  interface ProcessEnv {
    VITEST?: string;
    VITEST_WORKER_ID?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
  }
}
