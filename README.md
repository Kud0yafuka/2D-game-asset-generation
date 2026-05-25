# SpriteCraft Studio

SpriteCraft Studio 是一个面向独立游戏开发者、Game Jam 团队和小型 2D 工作室的 2D 游戏素材生成工作台。产品目标是将简短文本提示和简单参数转化为可用于游戏项目的素材，并支持后续预览、调整和导出到常见游戏引擎工作流中。

## 当前里程

- PR 1：React + Vite + TypeScript 项目脚手架、CI、文档和比赛背景说明。
- PR 2：SpriteCraft Studio 编辑器布局、设计系统、预览模式、参数面板、队列框架和 Inspector 框架。
- PR 3：Mock 生成工作流，包括本地素材创建、队列状态、prompt 校验、历史更新和 Style Lock 行为。
- PR 4：通过本地 API 代理接入真实图像生成。
- PR 5：编辑与导出流水线，支持 PNG、sprite sheet、metadata JSON 和游戏引擎可用 ZIP 输出。
- PR 6：Demo 打磨、提交就绪面板、架构说明和最终展示材料。
- PR 7：基于实际体验反馈进行产品可用性清理。
- PR 8：仅保留豆包 Seedream 真实生成链路，并明确暴露 API 失败和结构化 prompt 日志。
- PR 9：实现 PNG、sprite sheet、JSON 和引擎 ZIP 的真实导出保存流程。
- PR 10：接入 Supabase 登录和云端素材库持久化。

## 产品方向

SpriteCraft Studio 设计为一个真实的编辑器界面，而不是营销落地页。

首屏即包含完整工作流：

- 素材类型：角色、怪物、道具、地块、UI、特效和历史记录。
- 预览模式：单图预览、sprite sheet、透明棋盘背景和动画播放。
- Prompt 参数：风格、尺寸、帧数、调色板、随机种子、透明背景和 Style Lock。
- Inspector：选中素材的 metadata、目标引擎和导出操作。
- 导出流水线：预览 PNG、sprite sheet PNG、metadata JSON，以及 Unity/Godot/Web ZIP 目录结构。
- 云端素材库：邮箱登录、自动保存素材、刷新恢复和用户级收藏。

## 技术栈

- React 19
- TypeScript
- Vite
- ESLint
- lucide-react 图标
- Supabase Auth、Database 和 Storage

## 本地开发

```bash
npm install
npm run dev
```

如需使用豆包 Seedream 真实生成，请基于 `.env.example` 创建 `.env.local`，并设置 `ARK_API_KEY`。浏览器端不会接触该 key，所有请求都会通过本地 API 代理转发。

如需启用用户素材库持久化，请在 `.env.local` 中设置 Supabase 相关变量，并参考 [Supabase setup](docs/supabase-setup.md) 完成配置。

运行质量检查：

```bash
npm run lint
npm run build
```

## 比赛说明

项目按聚焦的 PR 节奏推进：

1. 项目初始化与比赛配置。
2. 产品主界面和设计系统。
3. Mock 素材生成工作流。
4. 真实 AI 生成接入。
5. 编辑与导出流水线。
6. Demo 打磨与提交文档。
7. 产品可用性清理。
8. 仅保留豆包 Seedream 真实生成链路。
9. 导出保存流程修复。
10. 用户登录与云端持久化。

每个 PR 都保持 `main` 分支可运行，并包含聚焦的提交，方便评审理解开发过程。

有用的提交文档：

- [产品设计](docs/product-design.md)
- [架构说明](docs/architecture.md)
- [Supabase 配置](docs/supabase-setup.md)
- [Demo 脚本](docs/demo-script.md)
- [提交说明](docs/submission-notes.md)
