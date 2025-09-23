# Art Regeneration Pipeline

This guide documents the end-to-end workflow for regenerating Pixellab-based character, emote, bug-bot, and house assets with eight-frame looping animations. Follow these steps whenever art needs to be refreshed or re-exported to keep the Phaser runtime in sync with the source assets.

## Prerequisites

- **Pixellab account & API token**: export `PIXELLAB_TOKEN` (or `PIXELLAB_API_TOKEN`) in your shell before running any scripts.
- **Node.js & pnpm**: ensure the workspace dependencies are installed (`pnpm install`).
- **Codex CLI (optional)**: only required if you intend to orchestrate regeneration through the Codex MCP pipeline.
- **Clean working tree**: commit or stash unrelated changes. Asset regeneration touches large binary files.

```bash
export PIXELLAB_TOKEN="<your-token>"  # set once per shell session
```

## Directory Layout

- Source prompts & scripts: `scripts/`
- Intermediate downloads: `generated/pixellab/<category>/<entry>/`
- Public assets consumed by the game: `packages/frontend/public/assets/<category>/<entry>/`
- Generated manifest used by the frontend: `packages/frontend/src/assets/pixellabMetadata.ts`

## Regeneration Steps

1. **Remove stale outputs (optional but recommended)**

   ```bash
   rm -rf generated/pixellab/{agents,emotes,bug-bots}
   ```

2. **Regenerate specified categories**
   - Full run for agents, emotes, and bug-bots:
     ```bash
     node scripts/generate-agents.mjs --category agents,emotes,bugBots
     ```
   - Regenerate a specific entry (example: only the “awakening” emote):
     ```bash
     node scripts/generate-agents.mjs --category emotes --entry awakening
     ```
     The script now queues every job with explicit “8-frame looping animation” language in the prompts so Pixellab returns consistent eight-frame exports.

3. **Sync into `packages/frontend/public/assets`**
   - `scripts/generate-agents.mjs` automatically copies the freshly extracted frames and metadata into the public asset folders.
   - Confirm that each entry contains updated sprites and a `metadata.json` file.

4. **Refresh animation manifest**
   ```bash
   node scripts/generate-pixellab-manifest.mjs
   ```
   This regenerates `packages/frontend/src/assets/pixellabMetadata.ts` with the latest frame counts so Phaser knows every direction now has eight frames.

## Verification Checklist

- ✅ Inspect `packages/frontend/public/assets/<category>/<entry>/metadata.json` and confirm each direction array length is `8`.
- ✅ Ensure `generated/pixellab/<category>/<entry>/extracted/` contains the expected PNG sequences and preview images.
- ✅ Run lint & tests when regeneration touches the manifest or other code:
  ```bash
  pnpm -w lint
  pnpm -r test
  ```
- ✅ Review `packages/frontend/src/assets/pixellabMetadata.ts` for unexpected diffs.

## Troubleshooting

| Symptom                                  | Fix                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Script exits with `PIXELLAB_TOKEN` error | Export `PIXELLAB_TOKEN` in the current shell.                                                                                                  |
| Assets still show six frames             | Delete the affected entry under `generated/pixellab/...` and re-run the script so the new prompt (with eight-frame instructions) takes effect. |
| Manifest still lists old counts          | Re-run `node scripts/generate-pixellab-manifest.mjs` and commit the regenerated `pixellabMetadata.ts`.                                         |
| Preview PNG missing                      | Check that the Pixellab job completed successfully and the ZIP was downloaded; rerun the generation step if needed.                            |

## Follow-up Tasks

- Commit regenerated assets and the updated manifest together.
- Update release notes or commit messages with the regenerated entries to aid QA.
- If new animation templates are added, include the template ID and desired frame count in `scripts/generate-agents.mjs` so future runs stay consistent.

## Tileset Workflow

- Top-down biomes live under `packages/frontend/public/assets/tiles/biome/`; interiors live under `packages/frontend/public/assets/tiles/interior/`.
- Generate new tilesets with the helper script:

  ```bash
  # Regenerate every configured tileset
  PIXELLAB_TOKEN=... node scripts/generate-tiles.mjs

  # Only outdoor biomes or a specific entry
  PIXELLAB_TOKEN=... node scripts/generate-tiles.mjs --category biome
  PIXELLAB_TOKEN=... node scripts/generate-tiles.mjs --tileset grass-road

  # Just interior themes
  PIXELLAB_TOKEN=... node scripts/generate-tiles.mjs --category interior
  ```

- Each run downloads a 4×4 Wang tileset image (`tileset.png`) plus `wang-metadata.json` for corner data and writes a friendly `metadata.json` describing prompts, passability, and base tile IDs.
- Tile manifests are folded into `packages/frontend/src/assets/pixellabMetadata.ts` via:
  ```bash
  PIXELLAB_TOKEN=... node scripts/generate-pixellab-manifest.mjs
  ```
- The manifest exports `pixellabTileMetadata` for the game engine; use the stored base tile IDs to chain new terrain transitions as needed.

## Interior Style Guides

| Theme                      | Palette & Mood                            | Signature Elements                                   | Floor/Accent Pairing                          |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| JavaScript Neon Lab        | Cyan + magenta neon on obsidian glass     | Holo terminals, quantum rigs, neon signage           | Obsidian trace floor → holographic walkway    |
| TypeScript Blueprint Hall  | Blueprint blue, parchment cream, brass    | Drafting tables, rolled plans, precision instruments | Slate drafting floor → glowing blueprint rugs |
| Python Observatory Cottage | Indigo, candlelit bronze, mystical greens | Telescopes, star charts, serpent motifs              | Spiral stone tiles → star map mosaic          |
| Go Coastal Lodge           | Seafoam, driftwood taupe, rope            | Nets, shells, maritime charts                        | Driftwood planks → woven rope runner          |
| Ruby Artisan Workshop      | Ruby reds, cherrywood, burnished brass    | Gem polishers, jeweler benches, artisan tools        | Cherrywood floor → velvet ruby carpet         |
| Java Brew Guild            | Coffee browns, copper glow, burlap        | Espresso bars, bean roasters, stacked burlap sacks   | Cobblestone floor → coffee bean mosaic        |
| C# Azure Conservatory      | Azure glass, silver steel, bracket glyphs | Pipe-organ consoles, azure flora, light prisms       | Frosted glass floor → illuminated walkway     |
| Commons Guild Hall         | Neutral stone, lantern brass, parchment   | Notice boards, communal tables, rolled scrolls       | Neutral stone → woven tatami mats             |
