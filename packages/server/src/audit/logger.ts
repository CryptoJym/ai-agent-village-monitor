/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { scrubObject } from '../middleware/redact';
import { AuditEvent, AuditEventType } from './types';

function nowIso() {
  return new Date().toISOString();
}

export class AuditLogger {
  private filePath?: string;

  constructor() {
    const p = process.env.AUDIT_LOG_FILE;
    if (p && p.trim()) {
      try {
        const dir = path.dirname(p);
        fs.mkdirSync(dir, { recursive: true });
        this.filePath = p;
      } catch {
        this.filePath = undefined;
      }
    }
  }

  log(type: AuditEventType, payload: Record<string, unknown> = {}) {
    const evt: AuditEvent = { type, ts: nowIso(), ...payload };
    const safe = scrubObject(evt);
    const line = JSON.stringify(safe);
    if (this.filePath) {
      try {
        fs.appendFileSync(this.filePath, line + '\n');
      } catch {
        console.info('[audit]', line);
      }
    } else {
      console.info('[audit]', line);
    }
  }
}

export const audit = new AuditLogger();
