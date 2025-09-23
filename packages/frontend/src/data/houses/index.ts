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
  javascriptBlueprint,
  typescriptBlueprint,
  pythonBlueprint,
  goBlueprint,
  rubyBlueprint,
  javaBlueprint,
  csharpBlueprint,
  commonsBlueprint,
];

export type { HouseBlueprint };
