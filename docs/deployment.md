# 部署上线说明

SpriteCraft Studio 已正式部署为 Render Node Web Service。线上版本同时承载前端静态页面和后端 `/api`，适合展示完整的生图、登录、云端保存和导出流程。

## 线上地址

- 产品地址：[https://spritecraft-studio.onrender.com](https://spritecraft-studio.onrender.com)
- 健康检查：[https://spritecraft-studio.onrender.com/api/health](https://spritecraft-studio.onrender.com/api/health)

## 部署形态

本项目不是纯静态站点。生产环境需要运行 Node 服务，原因包括：

- `/api/generate` 在服务端调用火山方舟 Ark / Doubao Seedream，避免将生图 API Key 暴露到浏览器。
- `/api/library` 在服务端校验 Supabase 登录态，并使用服务端密钥写入私有 Storage。
- 前端构建产物由同一个 Express 服务托管，保证页面和 API 同域访问。

Render 使用仓库中的 `render.yaml` 进行配置：

- 构建命令：`npm ci && npm run build`
- 启动命令：`npm run start`
- 健康检查路径：`/api/health`
- 运行计划：Free

## 环境变量

线上需要在 Render Dashboard 中配置以下变量：

- `ARK_API_KEY`：火山方舟 Ark API Key，仅服务端使用。
- `ARK_BASE_URL`：Ark OpenAI 兼容接口地址。
- `ARK_IMAGE_MODEL`：Doubao Seedream 模型名。
- `ARK_IMAGE_SIZE`：默认生成尺寸。
- `ARK_IMAGE_WATERMARK`：是否开启水印。
- `NPM_CONFIG_PRODUCTION`：设为 `false`，确保 Render 构建阶段安装 Vite、TypeScript 等构建依赖。
- `VITE_SUPABASE_URL`：Supabase 项目 URL。
- `VITE_SUPABASE_ANON_KEY`：Supabase 浏览器登录公钥。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务端密钥，仅后端使用。
- `SUPABASE_ASSET_BUCKET`：素材存储 bucket 名称。

不要把真实密钥提交到 GitHub。`.env.local` 只用于本地开发，线上密钥只放在 Render 环境变量中。

## 上线验证记录

本次上线完成后已验证：

- 线上首页返回 `HTTP 200`。
- `/api/health` 返回 `hasKey: true` 和 `hasSupabase: true`。
- 健康检查显示 provider 为 `ark`，模型为 `doubao-seedream-5-0-260128`。
- Render 日志显示服务通过 `npm run start` 启动，并监听 Render 分配的端口。

## 运维说明

日常演示只需要访问线上地址。Render Dashboard 主要在以下场景使用：

- 查看部署状态和运行日志。
- 修改 Ark 或 Supabase 环境变量。
- 触发手动部署。
- 绑定自定义域名。
- 升级实例，减少 Free 实例休眠带来的首次访问等待。

当前使用 Render Free 实例。服务长时间无人访问后可能休眠，首次打开可能需要几十秒唤醒，这是平台限制，不是应用错误。
