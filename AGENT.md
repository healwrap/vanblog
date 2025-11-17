# VanBlog 项目架构说明

## 1. 项目结构与技术栈

- 仓库采用 **pnpm workspace monorepo** 组织，根目录主要用于脚本和工具，业务代码均在 `packages/*` 中。
- 主要子项目：
  - `packages/server`：后端服务（NestJS + MongoDB），提供所有业务 API 与 Swagger 文档。
  - `packages/website`：前台默认主题（Next.js + React + Tailwind CSS），面向访客展示内容。
  - `packages/admin`：后台管理面板（Umi + Ant Design Pro），用于站点配置与内容管理。
  - `packages/waline`：内嵌 Waline 评论服务的后端。
  - `packages/cli`：配套 CLI 工具，用于容器内运维辅助。
- 运行形态：通过根目录 `Dockerfile` 多阶段构建为单一镜像，在容器中同时运行 server、website、admin 静态资源服务、waline 和 caddy 反向代理。
- 技术栈层级：
  - 前台：Next.js、React、Tailwind CSS、bytemd、Waline 客户端等。
  - 后台：Umi、Ant Design Pro、Ant Design、bytemd、Monaco Editor 等。
  - 后端：NestJS、MongoDB、Mongoose、JWT、Swagger、定时任务等。
  - 基础设施：Docker、Caddy、GitHub Actions（可用 act 本地模拟）。

## 2. 页面与路由关系

### 2.1 前台 website（Next.js pages 路由）

页面位于 `packages/website/pages`：

- 主要页面：`/`（首页）、`/about`、`/link`、`/timeline`、`/404` 等。
- 列表类页面：`/tag`、`/category`，分别展示标签和分类总览。
- 动态内容页面：
  - `/post/[id]`：文章详情。
  - `/page/[p]`：分页列表（第 p 页）。
  - `/tag/[tag]`：按标签过滤文章。
  - `/category/[category]`：按分类过滤文章。
- 内置 API 路由：`/api/revalidate`，用于触发 Next.js 增量静态渲染（ISR），在内容变更后刷新对应静态页面。
- 全局入口：
  - `_app.tsx`：负责全局布局、主题、上下文等。
  - `_document.tsx`：自定义 HTML 结构和基础 meta。

### 2.2 后台 admin（Umi 路由）

- 路由定义在 `packages/admin/config/routes` 中，并与左侧菜单结构对应。
- 主要模块：
  - 仪表盘：展示站点整体统计信息（访问量、文章数等）。
  - 内容管理：文章、草稿、分类、标签等的增删改查。
  - 站点配置：站点信息、关于、友链、菜单、社交信息、打赏配置等。
  - 自定义页面：管理自定义路由页面（customPage）。
  - 系统管理：备份与恢复、日志、Caddy 配置、访问分析、增量渲染管理、协作者和 Token 管理等。
- Admin 构建后为纯静态页面，通过 `/admin/` 路径对外提供。

## 3. 接口与服务关系

### 3.1 后端模块结构（NestJS）

- 入口：`packages/server/src/main.ts` 创建 `NestExpressApplication`，注册全局配置（静态目录、JSON 体积限制等）并启动 HTTP 服务。
- 核心模块：`app.module.ts` 中：
  - 使用 `MongooseModule.forRoot` 建立 Mongo 连接。
  - 注册业务 Schema：文章、草稿、用户、元信息、访问统计、站点配置、自定义页面、Token、分类、流水线等。
  - 注册 `JwtModule`（动态 secret 与过期时间）和 `ScheduleModule`（定时任务）。
  - 汇总所有 Controllers 与 Providers。

### 3.2 控制器与服务层

- 公共接口（供前台使用）：
  - `public/public.controller.ts`：文章列表与详情、站点配置、归档数据、统计上报等只读接口。
  - `customPage/customPage.controller.ts`：暴露自定义页面的公共访问接口。
- 后台接口（/admin）：
  - about/link/reward/site/social/menu 等控制器：管理各类站点元信息与配置。
  - article/draft/category/tag 控制器：管理内容与分类体系。
  - customPage 控制器：管理自定义页面内容与路由。
  - backup/log/caddy/analysis/isr/pipeline/token 控制器：负责备份、日志、网关配置、统计分析、增量渲染和发布流水线相关操作。
  - auth/init 控制器：登录与系统初始化。
- Provider（服务层）：
  - 如 `ArticleProvider`、`DraftProvider`、`CategoryProvider`、`TagProvider`、`MetaProvider` 等，封装各领域业务逻辑与 Mongo 操作。
  - `ViewerProvider`、`VisitProvider`：记录并统计访问和浏览数据。
  - `SettingProvider`、`StaticProvider`、`PicgoProvider`、`LocalProvider`：管理站点配置与图床/静态资源。
  - `ISRProvider`：封装调用 website ISR 接口的逻辑。
  - `WalineProvider`：管理评论系统相关配置。

### 3.3 鉴权与权限

- 使用 `@nestjs/jwt` 与 Passport 实现认证：
  - 登录接口返回 JWT，后续请求通过 Authorization 头携带。
  - `JwtStrategy`、`LocalStrategy` 对接 NestJS 守卫，完成 token 与账号校验。
- 守卫层：
  - `LoginGuard`：校验用户是否已登录。
  - `AccessGuard`：根据角色或权限配置控制后台操作。
  - `TokenGuard`：用于基于 Token 的接口访问控制（如流水线或 Webhook 调用）。

### 3.4 Website / Admin / Waline 与 server 的交互

- Website（前台）：
  - 在 `packages/website/api/*.ts` 中封装访问后端的函数，如 `getAllData`、`getArticles`、`getArticleViewer`、`search`、`pageview` 等。
  - 通过环境变量 `VAN_BLOG_SERVER_URL` 统一确定后端地址。
- Admin（后台）：
  - 通过 Umi 内置的 `request` 封装访问 NestJS 的管理接口（如 `/api/admin/...`）。
  - 登录后由浏览器保存 JWT，并在后续请求中自动携带。
- Waline：
  - 在容器中以独立 Node 服务运行，连接 Mongo 中独立数据库（例如 `waline`）。
  - Website 通过 `@waline/client` 在文章详情页嵌入评论组件，由 Caddy 反向代理到 Waline 服务。

### 3.5 ISR 与静态化

- Server 端：通过 `ISRProvider` 和 `ISRController` 提供全量或局部增量渲染触发接口。
- Website 端：`pages/api/revalidate.ts` 实现实际的 Next.js ISR 逻辑，根据传入 path 或 tag 重新生成页面。
- 典型流程：后台修改文章 → 后端保存数据库并调用 ISRProvider → 转发到 website 的 `/api/revalidate` → 对应页面重新静态化。

## 4. npm 依赖概览

### 4.1 根 package.json

- 主要职责：统一脚本和开发工具，不承载业务逻辑依赖。
- 关键脚本：
  - 构建：`build`、`build:server`、`build:website`、`build:admin`。
  - 开发：`dev`、`dev:server`、`dev:website`、`dev:admin`。
  - 文档与发版：`docs:dev`、`docs:build`、`release*`、`release-doc` 等。
- 开发依赖：`eslint`、`@typescript-eslint/*`、`prettier`、`standard-version`、`cross-env` 等。

### 4.2 @vanblog/server（后端）

- 框架与基础设施：`@nestjs/common`、`@nestjs/core`、`@nestjs/platform-express`、`@nestjs/mongoose`、`mongoose`、`mongodb`。
- 鉴权与文档：`@nestjs/jwt`、`@nestjs/passport`、`passport` 系列、`@nestjs/swagger`、`swagger-ui-express`、`@nestjs/schedule`。
- 工具类库：`axios`、`cheerio`、`dayjs`、`lodash`、`js-base64`、`js-sha256`、`jimp`、`markdown-it`、`highlight.js`、`feed`、`sitemap`、`yaml` 等。

### 4.3 @vanblog/theme-default（前台）

- 框架与样式：`next`、`react`、`react-dom`、`tailwindcss`、`postcss`、`autoprefixer`。
- Markdown 渲染：`bytemd` 及其插件、`remark-*`、`rehype-raw`、`katex`、`mermaid`、`react-syntax-highlighter` 等。
- 交互与功能：`@waline/client`、`react-hot-toast`、`react-photo-view`、`react-burger-menu`、`react-use`、`copy-to-clipboard` 等。

### 4.4 @vanblog/admin（后台）

- 框架与 UI：`umi`、`antd`、`@ant-design/pro-*`、`@ant-design/icons`。
- 编辑与展示：`bytemd` 系列、`katex`、`emoji-mart`、`monaco-editor`、`react-monaco-editor`。
- 工具库：`lodash`、`moment`、`pinyin-match`、`classnames` 等。

### 4.5 其他子包

- `packages/waline`：封装 Waline 评论后端，在容器中以独立 Node 服务运行。
- `packages/cli`：项目 CLI 工具，在最终镜像中安装依赖后供运维脚本调用。

## 5. 开发与部署流程

### 5.1 本地开发

1. 准备 MongoDB 实例（可通过 Docker 暴露 27017 端口）。
2. 克隆项目并在根目录执行 `pnpm i` 安装依赖。
3. 在 `packages/server` 创建 `config.yaml`，配置数据库连接、静态目录、日志路径、Waline 数据库等。
4. 在根目录执行 `pnpm dev`，一次性启动 server（3000）、website（3001）、admin（3002）。
5. 也可单独开发：先执行 `pnpm dev:server`，再根据需要执行 `pnpm dev:website` 和 `pnpm dev:admin`。
6. 文档开发：在根目录执行 `pnpm docs:dev`（默认 8080 端口）。

### 5.2 构建

- 根目录执行 `pnpm build`，并行构建 server / website / admin 三部分。
- 如需单独构建，可分别执行 `pnpm build:server`、`pnpm build:website`、`pnpm build:admin`。

### 5.3 Docker 打包与运行

- 使用根目录 `Dockerfile` 多阶段构建镜像：
  - ADMIN_BUILDER：构建 admin 静态资源。
  - SERVER_BUILDER：构建 NestJS 后端。
  - WEBSITE_BUILDER：构建 Next.js 前台（standalone 输出）。
  - RUNNER：安装 caddy、waline、cli，复制上述构建产物并设置环境变量与卷，暴露 80 端口。
- 典型命令（省略具体参数）：

```bash
pnpm dev       # 启动三端开发环境
pnpm build     # 构建 server / website / admin
docker build -t vanblog:latest .  # 构建 all-in-one 镜像
```
