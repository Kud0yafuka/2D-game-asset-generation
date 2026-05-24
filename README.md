# SpriteCraft Studio

SpriteCraft Studio is a 2D game asset generation workbench for independent game developers, Game Jam teams, and small 2D studios. The product goal is to turn short text prompts and simple parameters into game-ready assets that can later be previewed, refined, and exported into common engine workflows.

This repository is being built for the XEngineer competition topic: 2D game asset generation.

## Current Milestone

The first three pull requests establish the project foundation, the product shell, and the first working local generation workflow:

- PR 1: React + Vite + TypeScript scaffold, CI, documentation, and competition framing.
- PR 2: SpriteCraft Studio editor layout, design system, static demo asset library, preview modes, parameter panel, queue shell, and inspector shell.
- PR 3: Mock generation workflow with local asset creation, queue state, prompt validation, history updates, and Style Lock behavior.

The real AI generation endpoint and export pipeline are intentionally scheduled for later PRs so the repository shows a clear 72-hour iteration process.

## Product Direction

SpriteCraft Studio is designed as a real editor surface rather than a marketing page. The first screen contains the workflow:

- Asset families: character, monster, prop, tile, UI, effect, and history.
- Preview modes: single image, sprite sheet, alpha checkerboard, and animation playback.
- Prompt controls: style, size, frame count, palette, seed, transparency, and style lock.
- Inspector: selected asset metadata, engine target, and planned export actions.

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

Run quality checks:

```bash
npm run lint
npm run build
```

## Competition Notes

The implementation is planned around six focused pull requests:

1. Project bootstrap and competition setup.
2. Product shell and design system.
3. Mock asset workflow.
4. Real AI generation integration.
5. Editing and export pipeline.
6. Demo polish and submission docs.

Each PR keeps the main branch runnable and includes focused commits, making the development process easy to review.
