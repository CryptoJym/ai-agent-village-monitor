import { useEffect, useState } from 'react';
import { VillageSchema } from '../api/schemas';

export type ViewerRole = 'owner' | 'member' | 'visitor' | 'none';

export function useViewerRole(villageId?: string) {
  const [role, setRole] = useState<ViewerRole>('none');
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!villageId) {
        setRole('none');
        return;
      }
      try {
        const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          setRole('none');
          return;
        }
        const data = await res.json();
        const parsed = VillageSchema.safeParse(data);
        if (!cancelled) setRole(parsed.success ? parsed.data.viewerRole || 'none' : 'none');
      } catch {
        if (!cancelled) setRole('none');
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [villageId]);
  return role;
}
