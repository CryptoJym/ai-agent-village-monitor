import javascriptBlueprint from './javascript.json';
import typescriptBlueprint from './typescript.json';
import pythonBlueprint from './python.json';
import goBlueprint from './go.json';
import rubyBlueprint from './ruby.json';
import javaBlueprint from './java.json';
import csharpBlueprint from './csharp.json';
import commonsBlueprint from './commons.json';

import type { HouseBlueprint } from './types';

export const houseBlueprints: HouseBlueprint[] = [
  javascriptBlueprint as HouseBlueprint,
  typescriptBlueprint as HouseBlueprint,
  pythonBlueprint as HouseBlueprint,
  goBlueprint as HouseBlueprint,
  rubyBlueprint as HouseBlueprint,
  javaBlueprint as HouseBlueprint,
  csharpBlueprint as HouseBlueprint,
  commonsBlueprint as HouseBlueprint,
];

export type { HouseBlueprint };
