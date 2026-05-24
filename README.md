# SpriteCraft Studio

SpriteCraft Studio is a 2D game asset generation workbench for independent game developers, Game Jam teams, and small 2D studios. The product goal is to turn short text prompts and simple parameters into game-ready assets that can later be previewed, refined, and exported into common engine workflows.

This repository is being built for the XEngineer competition topic: 2D game asset generation.

## Current Milestone

The staged pull requests establish a complete competition-ready workflow:

- PR 1: React + Vite + TypeScript scaffold, CI, documentation, and competition framing.
- PR 2: SpriteCraft Studio editor layout, design system, preview modes, parameter panel, queue shell, and inspector shell.
- PR 3: Mock generation workflow with local asset creation, queue state, prompt validation, history updates, and Style Lock behavior.
- PR 4: Real image generation through a local API proxy.
- PR 5: Editing and export pipeline with PNG, sprite sheet, metadata JSON, and engine-ready ZIP output.
- PR 6: Demo polish, submission readiness panel, architecture notes, and final presentation materials.
- PR 7: Product usability cleanup based on hands-on review feedback.
- PR 8: Doubao Seedream only generation path with explicit API failures and structured prompt logging.

The PR sequence is intentionally staged so the repository shows a credible 72-hour solo development process.

## Product Direction

SpriteCraft Studio is designed as a real editor surface rather than a marketing page. The first screen contains the workflow:

- Asset families: character, monster, prop, tile, UI, effect, and history.
- Preview modes: single image, sprite sheet, alpha checkerboard, and animation playback.
- Prompt controls: style, size, frame count, palette, seed, transparency, and style lock.
- Inspector: selected asset metadata, engine target, and planned export actions.
- Export pipeline: preview PNG, sprite sheet PNG, metadata JSON, and Unity/Godot/Web ZIP structure.

## Tech Stack

- React 19
- TypeScript
- Vite
- ESLint
- lucide-react icons

## Local Development

```bash
npm install
npm run dev
```

For Doubao Seedream-backed generation, create `.env.local` from `.env.example` and set `ARK_API_KEY`. The browser never receives this key; requests go through the local API proxy.

Run quality checks:

```bash
npm run lint
npm run build
```

## Competition Notes

The implementation is planned around focused pull requests:

1. Project bootstrap and competition setup.
2. Product shell and design system.
3. Mock asset workflow.
4. Real AI generation integration.
5. Editing and export pipeline.
6. Demo polish and submission docs.
7. Product usability cleanup.
8. Doubao Seedream only generation.

Each PR keeps the main branch runnable and includes focused commits, making the development process easy to review.

Useful submission docs:

- [Product design](docs/product-design.md)
- [Architecture notes](docs/architecture.md)
- [Demo script](docs/demo-script.md)
- [Submission notes](docs/submission-notes.md)
