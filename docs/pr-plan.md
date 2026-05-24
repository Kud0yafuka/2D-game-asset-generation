# 72 Hour PR Plan

SpriteCraft Studio uses six focused pull requests to show a credible solo development process.

Current local scope: PR 3 is prepared locally but should not be pushed until the next development day.

| PR | Theme | Review focus |
| --- | --- | --- |
| 1 | Project bootstrap and competition setup | Tooling, README, CI, project framing |
| 2 | Product shell and design system | Editor layout, components, responsive structure |
| 3 | Mock asset workflow | Domain model, queue, demo generation, selection flow |
| 4 | Real AI generation integration | Secure proxy, errors, fallback behavior, key safety |
| 5 | Editing and export pipeline | Sprite sheet preview, metadata, PNG/JSON/ZIP exports |
| 6 | Demo polish and submission docs | Demo script, screenshots, judging highlights |
| 7 | Product usability cleanup | Remove inactive UI and clarify generation controls |
| 8 | Doubao Seedream only generation | Remove mock fallback, expose real API failures, log structured prompts |

Commit messages are intentionally small and behavior-oriented, with each PR keeping the app runnable.

Final PR status:

- PR 1 through PR 5 build the product workflow.
- PR 6 packages the work for review with final UI polish, architecture notes, and submission talking points.
- PR 7 and PR 8 capture hands-on product feedback after review: cleaner UI and a trustworthy real-model generation path.
