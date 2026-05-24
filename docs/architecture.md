# Architecture Notes

SpriteCraft Studio is split into clear product layers so the competition review can follow both the user workflow and the engineering structure.

## Frontend Shell

- `src/App.tsx` owns the main workflow state: selected category, generation params, assets, queue, preview mode, engine target, and API health.
- `src/components` contains focused editor regions: navigation, preview, asset grid, controls, queue, inspector, and submission readiness.
- `src/data/catalog.ts` defines product taxonomy: asset families, style presets, palette presets, sizes, and engine targets.

## Generation Flow

- Mock generation lives in `src/services/mockGeneration.ts` and uses deterministic local SVG assets for reliable demos.
- OpenAI generation lives behind `server/index.ts`, keeping `OPENAI_API_KEY` out of the browser.
- `src/services/apiGeneration.ts` calls the local API and falls back to the mock generator if the live path fails.

## Export Flow

- `src/lib/exporters.ts` converts the selected asset into preview PNG, sprite sheet PNG, metadata JSON, and engine-oriented ZIP bundles.
- Metadata follows `spritecraft.asset.v1` and records category, source, engine target, size, frames, style, palette, seed, tags, usage, and output file names.

## Review-Oriented Qualities

- The app is usable from the first screen rather than being a landing page.
- Every major control updates real local UI state.
- Main stays runnable after each PR.
- API key handling is server-side only.
- Mock fallback protects the demo from network, quota, or API instability.
