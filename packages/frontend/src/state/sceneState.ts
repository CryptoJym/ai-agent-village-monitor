type VillageState = {
  agent?: { x: number; y: number };
  camera?: { scrollX: number; scrollY: number; zoom?: number };
};

const memory: Record<string, VillageState> = {};

export function saveVillageState(villageId: string, state: VillageState) {
  memory[villageId] = { ...memory[villageId], ...state };
}

export function loadVillageState(villageId: string): VillageState | undefined {
  return memory[villageId];
}
