# Architecture Notes

SpriteCraft Studio is split into clear product layers so the competition review can follow both the user workflow and the engineering structure.

## Frontend Shell

- `src/App.tsx` owns the main workflow state: selected category, generation params, assets, queue, preview mode, and engine target.
- `src/components` contains focused editor regions: navigation, preview, asset grid, controls, queue, and inspector.
- `src/data/catalog.ts` defines product taxonomy: asset families, style presets, palette presets, sizes, and engine targets.

## Generation Flow

- Doubao Seedream generation lives behind `server/index.ts`, keeping `ARK_API_KEY` out of the browser.
- `src/services/apiGeneration.ts` calls the local API directly and surfaces real failures to the queue.
- `server/index.ts` logs the structured prompt, model, request id, duration, and success or failure reason for every generation request.

## Export Flow

- `src/lib/exporters.ts` converts the selected asset into preview PNG, sprite sheet PNG, metadata JSON, and engine-oriented ZIP bundles.
- Metadata follows `spritecraft.asset.v1` and records category, source, engine target, size, frames, style, palette, seed, tags, usage, and output file names.

## Review-Oriented Qualities

- The app is usable from the first screen rather than being a landing page.
- Every major control updates real local UI state.
- Main stays runnable after each PR.
- API key handling is server-side only.
- Generation failures are explicit instead of being replaced with local mock assets.
