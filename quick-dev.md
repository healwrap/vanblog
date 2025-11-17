# VanBlog 本地快速开发指南

## 环境准备
- Node.js 18（或更高 LTS）
- pnpm（使用 Corepack 管理）
- Docker（用于本地 MongoDB）

## 获取代码
- `git clone https://github.com/mereithhh/vanblog.git`
- `cd vanblog`

## 安装依赖
- `corepack enable`
- `corepack prepare pnpm@8.11.0 --activate`
- `pnpm install`

## 启动 MongoDB（推荐 Docker，无需认证）
- `docker run -d --name vanblog-mongo-dev -p 27018:27017 -e TZ=Asia/Shanghai mongo:4.4.16`
- 如已有 Mongo 实例，可跳过本步骤，并在后续配置中改为你的连接串

## 最少配置
在 `packages/server` 目录创建 `config.yaml`（服务端自动读取）
  ```yaml
  database:
    url: "mongodb://127.0.0.1:27018/vanBlog"
  static:
    path: "/绝对路径/vanblog/.dev/static"
  codeRunner:
    path: "/绝对路径/vanblog/.dev/codeRunner"
  pluginRunner:
    path: "/绝对路径/vanblog/.dev/pluginRunner"
  log: "/绝对路径/vanblog/.dev/log"
  ```
  - 将上述路径替换为你本机的项目绝对路径

## 使用 .env 文件（前台与后台）
- 前台（Next.js）：在 `packages/website/.env.development.local`
  ```ini
  VAN_BLOG_SERVER_URL=http://localhost:3000
  VAN_BLOG_REVALIDATE=false
  # VAN_BLOG_REVALIDATE_TIME=10
  ```
  - 开发模式自动加载，无需在命令行传参
- 管理后台（Umi）：在 `packages/admin/.env.development`
  ```ini
  PORT=3003
  REACT_APP_ENV=dev
  UMI_ENV=dev
  ```
  - 固定开发端口为 3003，保持与文档一致

## 启动服务
- 启动后端（建议先启动）
  - `pnpm dev:server`
  - 后端监听 `http://localhost:3000`
- 启动管理后台
  - `pnpm dev:admin`
  - 终端会打印实际端口（通常为 `http://localhost:3003`）
- 启动前台站点（可选）
  - `pnpm dev:website`
  - 前台监听 `http://localhost:3001`

## 首次初始化与登录
- 打开管理后台（终端打印的地址）
- 首次访问将自动进入“初始化”页面，配置站点信息与管理员账号
- 初始化完成后，使用刚创建的管理员账号登录

## 常用入口
- 后端 Swagger：`http://localhost:3000/swagger`
- 管理后台：终端打印的 `App running at` 地址（通常 `http://localhost:3003`）
- 前台站点：`http://localhost:3001`

## 常见问题
- 前台/后台报错 `ECONNREFUSED`
  - 先确保后端 `http://localhost:3000` 已启动
  - 前台需设置 `VAN_BLOG_SERVER_URL="http://localhost:3000"`
- 后端尝试创建 `/app/...` 报错
  - 本地开发不要使用 `/app` 路径，按“最少配置”章节改为本机可写绝对路径
- 数据库认证错误
  - 如果你的 MongoDB 开启认证，请在连接串中加入账号密码与 `authSource=admin`
- 管理接口返回 401/403
  - 管理接口需要登录获取 `token`；初始化完成后，通过后台登录获取并自动携带