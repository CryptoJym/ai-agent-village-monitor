import { z } from 'zod';

export const WorkStreamEventDTO = z.object({
  event_type: z.string(),
  content: z.string().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
  timestamp: z.string(),
});

export type WorkStreamEventDTO = z.infer<typeof WorkStreamEventDTO>;

// Flexible mapper to accommodate both legacy {message, ts} and newer {eventType, content, metadata, timestamp}
export function toEventDTO(row: any): WorkStreamEventDTO {
  if (row && typeof row.eventType === 'string') {
    const timestamp = row.timestamp instanceof Date ? row.timestamp.toISOString() : (row.timestamp || new Date().toISOString());
    return { event_type: row.eventType, content: row.content ?? null, metadata: row.metadata ?? null, timestamp };
  }
  const message: string = (row?.message as string) || '';
  const idx = message.indexOf(':');
  const event_type = idx > 0 ? message.slice(0, idx).trim() : message.trim() || 'log';
  const content = idx > 0 ? message.slice(idx + 1).trim() : null;
  const timestamp = row?.ts instanceof Date ? row.ts.toISOString() : (row?.ts || new Date().toISOString());
  return { event_type, content, metadata: null, timestamp };
}

export function toEventDTOs(rows: any[]): WorkStreamEventDTO[] {
  return rows.map((r) => toEventDTO(r));
}

