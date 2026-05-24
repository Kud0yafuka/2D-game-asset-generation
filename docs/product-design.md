# SpriteCraft Studio Product Design

SpriteCraft Studio is an AI-assisted 2D game asset workbench for solo developers, Game Jam teams, and small studios. The product focuses on generating usable assets for a real 2D pipeline rather than producing isolated images.

## Primary Workflow

1. Choose an asset family such as character, monster, prop, tile, UI, or effect.
2. Enter a short art direction and tune simple controls: style, size, frame count, palette, seed, and transparency.
3. Generate candidates with Doubao Seedream through the local API proxy.
4. Preview the result as a single asset, sprite sheet, checkerboard transparency view, or animated frame loop.
5. Export PNG, sprite sheet, metadata JSON, or an engine-ready ZIP.

The latest implementation keeps the product surface focused on the real asset workflow: parameterized Doubao Seedream generation, preview, inspection, and export.

## Design Principles

- Keep the first screen as the real tool.
- Treat prompt, style, palette, and export metadata as one connected workflow.
- Make API failures explicit so users can trust whether an asset came from the model.
- Make outputs understandable for Unity, Godot, and web pipelines.
