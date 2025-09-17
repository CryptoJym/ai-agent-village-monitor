import { describe, it, expect, beforeEach } from 'vitest';
import { setData, search } from '../../src/search/SearchIndex';

describe('SearchIndex', () => {
  beforeEach(() => {
    setData({ agents: [], houses: [], actions: [] });
  });

  it('includes house dashboard command in results', () => {
    setData({
      agents: [
        {
          type: 'agent',
          id: 'agent-1',
          name: 'Claude',
          status: 'idle',
          houseId: 'house-1',
          houseName: 'Core Lab',
        },
      ],
      houses: [
        {
          type: 'house',
          id: 'house-1',
          name: 'Core Lab',
          location: 'ts',
          components: ['Node', 'React'],
        },
      ],
      actions: [
        {
          type: 'action',
          id: 'dashboard:house-1',
          label: 'Open dashboard for Core Lab',
          actionId: 'openHouseDashboard',
          payload: { houseId: 'house-1' },
        },
      ],
    });
    const results = search('dashboard');
    const match = results.find((r) => r.actionRef?.actionId === 'openHouseDashboard');
    expect(match).toBeDefined();
    expect(match?.actionRef?.payload.houseId).toBe('house-1');
  });

  it('formats agent labels with house name when present', () => {
    setData({
      agents: [
        {
          type: 'agent',
          id: 'agent-99',
          name: 'Claude',
          status: 'idle',
          houseId: 'house-xy',
          houseName: 'Edge Tower',
        },
      ],
      houses: [],
      actions: [],
    });
    const [entry] = search('claude');
    expect(entry?.label).toContain('Edge Tower');
  });
});
