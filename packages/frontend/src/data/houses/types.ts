export type TileVertexValue = 0 | 1;

export interface PropPlacement {
  key: string;
  position: [number, number];
  layer: string;
  orientation?: 'north' | 'south' | 'east' | 'west';
  passable?: boolean;
}

export interface HouseBlueprint {
  theme: string;
  tilesetKey: string;
  dimensions: {
    width: number;
    height: number;
  };
  vertexGrid: TileVertexValue[][];
  props: PropPlacement[];
  spawns: {
    player: [number, number];
    npcs: [number, number][];
  };
}
