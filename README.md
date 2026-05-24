

```markdown
# SpriteCraft Studio

SpriteCraft Studio 是一个面向独立游戏开发者、Game Jam 团队和小型 2D 工作室的 2D 游戏资产生成工作台。产品目标是将简短的文字提示和简单参数转化为可直接用于游戏的资产，并支持后续预览、精修和导出到常见引擎的工作流。

## Current Milestone

六个 Pull Request 构建起一套完整的竞赛就绪工作流：

- PR 1：React + Vite + TypeScript 脚手架、CI、文档与竞赛框架搭建。
- PR 2：SpriteCraft Studio 编辑器布局、设计系统、静态演示资产库、预览模式、参数面板、队列外壳和检查器外壳。
- PR 3：模拟生成工作流，包含本地资产创建、队列状态、提示词验证、历史更新以及风格锁定行为。
- PR 4：通过本地 API 代理接入真实的 OpenAI 图像生成，并保留模拟回退以保证演示安全。
- PR 5：编辑与导出管线，支持 PNG、精灵表、元数据 JSON 以及引擎就绪的 ZIP 输出。
- PR 6：演示打磨、提交就绪面板、架构说明。

## 产品方向

SpriteCraft Studio 是一个真正的编辑器界面，而非营销页面。
首屏即呈现完整工作流：

- Asset families：角色、怪物、道具、图块、UI、特效和历史。
- 预览模式：单张图片、精灵表、Alpha 棋盘格和动画播放。
- 提示词控制：风格、尺寸、帧数、调色板、种子、透明度和风格锁定。
- 检查器：选中资产的元数据、引擎目标以及计划中的导出操作。
- Export pipeline：预览 PNG、精灵表 PNG、元数据 JSON 以及 Unity/Godot/Web ZIP 结构。
- 提交就绪：用于评判产品完成度、开发质量和演示呈现的最终检查清单。

## 技术栈

- React 19
- TypeScript
- Vite
- ESLint
- lucide-react 图标库

## 本地开发

```bash
npm install
npm run dev
```

如需使用 OpenAI 图像生成，请根据 `.env.example` 创建 `.env.local` 并设置 `OPENAI_API_KEY`。浏览器永远不会接触该密钥；所有请求均通过本地 API 代理转发。

运行质量检查：

```bash
npm run lint
npm run build
```

## 竞赛说明

整个实现围绕六个聚焦的 PR 展开：

1. 项目初始化和竞赛环境搭建。
2. 产品外壳与设计系统。
3. 模拟资产工作流。
4. 真实 AI 生成集成。
5. 编辑与导出管线。
6. 演示打磨与提交文档。

每个 PR 都保持主分支可运行，并包含专注的提交，使开发过程易于审查。

有用的提交文档：

- [产品设计](docs/product-design.md)
- [架构说明](docs/architecture.md)
- [演示脚本](docs/demo-script.md)
- [提交备注](docs/submission-notes.md)
```
