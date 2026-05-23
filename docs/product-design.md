# SpriteCraft Studio Product Design

SpriteCraft Studio is an AI-assisted 2D game asset workbench for solo developers, Game Jam teams, and small studios. The product focuses on generating usable assets for a real 2D pipeline rather than producing isolated images.

## Primary Workflow

1. Choose an asset family such as character, monster, prop, tile, UI, or effect.
2. Enter a short art direction and tune simple controls: style, size, frame count, palette, seed, and transparency.
3. Generate candidates with OpenAI or the built-in demo fallback.
4. Preview the result as a single asset, sprite sheet, checkerboard transparency view, or animated frame loop.
5. Export PNG, sprite sheet, metadata JSON, or an engine-ready ZIP.

The PR 2 implementation is a product shell: it contains the editor layout, static sample assets, stateful preview modes, and visible controls. Live generation and file export are intentionally deferred to later PRs.

## Design Principles

- Keep the first screen as the real tool.
- Treat prompt, style, palette, and export metadata as one connected workflow.
- Make failure states demo-safe with local fallback assets.
- Make outputs understandable for Unity, Godot, and web pipelines.
