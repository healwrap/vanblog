# VanBlog 生产部署快捷指南

## 概览
- 两种推荐方式：
  - 使用 `docker-compose` 手动编排
  - 使用一键脚本（vanblog CLI，`vanblog.sh`）
- 镜像：`mereith/van-blog:latest`（多架构）
- 组成：内置 Caddy 反向代理与证书自动申请、NestJS API（端口 3000）、Next.js 前台（端口 3001，统一由 Caddy 对外暴露 80/443）、Waline 评论（容器内运行）
- 首次启动需完成后台初始化

## 方式一：docker-compose

### 1. 安装依赖
- 安装 Docker 与 docker-compose（Linux）
  - `curl -sSL https://get.daocloud.io/docker | sh`
  - `systemctl enable --now docker`

### 2. 准备编排文件
- 在服务器新建目录 `vanblog`，创建 `docker-compose.yaml`，内容示例：
```yaml
version: '3'

services:
  vanblog:
    image: mereith/van-blog:latest
    restart: always
    environment:
      TZ: 'Asia/Shanghai'
      EMAIL: 'someone@mereith.com'
    volumes:
      - ${PWD}/data/static:/app/static
      - ${PWD}/log:/var/log
      - ${PWD}/caddy/config:/root/.config/caddy
      - ${PWD}/caddy/data:/root/.local/share/caddy
    ports:
      - 80:80
      - 443:443
  mongo:
    image: mongo:4.4.16
    restart: always
    environment:
      TZ: 'Asia/Shanghai'
    volumes:
      - ${PWD}/data/mongo:/data/db
```
- 变量说明：
  - `EMAIL`：用于 Caddy 自动申请 HTTPS 证书的邮箱
  - 映射卷：`/app/static`（站点静态资源与上传）、`/var/log`、Caddy 配置与证书存储
  - 端口：外部 80/443 → 容器 Caddy

### 3. 启动
- 在 `docker-compose.yaml` 所在目录运行：
  - `docker-compose up -d`
- 首次启动后，访问后台并完成初始化：
  - 管理后台：`https://你的域名/admin`
  - 主站前台：`https://你的域名/`

### 4. 可选配置
- 使用外部 MongoDB：
  - 删除 `mongo` 服务，并在 `vanblog` 服务增加环境变量：
    - `VAN_BLOG_DATABASE_URL="mongodb://user:pass@host:port/vanBlog?authSource=admin"`
- 参考环境变量：见 `docs/reference/env.md`

### 5. 运维
- 查看日志：`docker-compose logs -f`
- 更新镜像与重启：
  - `docker-compose pull && docker-compose down -v && docker-compose up -d`
- 备份与恢复：
  - 直接打包 `data/` 目录：`tar czvf vanblog-backup-$(date +%Y%m%d%H%M%S).tar.gz ./data`
  - 恢复：解压覆盖到同路径后 `docker-compose up -d`

## 方式二：vanblog CLI（一键脚本）

### 1. 获取并运行脚本
- 交互式安装：
  - `curl -L https://vanblog.mereith.com/vanblog.sh -o vanblog.sh && chmod +x vanblog.sh && ./vanblog.sh`
- 后续可直接运行：`./vanblog.sh`

### 2. 菜单与命令
- 菜单项：安装、修改配置、启动、停止、重启、更新、查看日志、卸载、重置 HTTPS、备份、恢复、更新脚本
- 直接命令示例：
  - `./vanblog.sh install`：安装并初始化基础环境
  - `./vanblog.sh config`：设置邮箱与端口，自动生成编排文件
  - `./vanblog.sh start` / `stop` / `restart`：启动/停止/重启服务
  - `./vanblog.sh update`：拉取最新镜像并重启
  - `./vanblog.sh log`：查看日志
  - `./vanblog.sh backup` / `restore`：备份/恢复 `data/`
  - `./vanblog.sh reset_https`：重置 HTTPS 设置（容器内执行 `/app/cli/resetHttps.js`）

### 3. 配置项说明
- 邮箱：用于自动申请 HTTPS 证书
- 端口：HTTP/HTTPS 对外监听（默认 80/443）
- 数据目录：默认 `/var/vanblog/data`（脚本会创建并赋权）
- 中国镜像加速：脚本会自动检测 IP 并提示是否使用国内源

### 4. 启动后初始化
- 管理后台：`https://你的域名/admin`
- 首次访问自动进入“初始化”页面，配置站点信息与管理员账号，完成后登录使用

## 验证与排错
- 首次验证：
  - 主站访问正常（首页）
  - 后台可进入初始化流程与登录
- 常见问题：
  - 证书未签发：确保域名解析到该服务器、`EMAIL` 正确、80/443 未被占用
  - 外部数据库连接失败：检查连接串并加入 `authSource=admin`；放入 `VAN_BLOG_DATABASE_URL` 环境变量
  - 前后端不通：检查容器日志，确认 `vanblog` 服务正常、端口映射正确

## 参考
- 容器编排模板：仓库 `docker-compose/docker-compose.yml`
- 环境变量文档：`docs/reference/env.md`
- 反向代理与外部容器：`docs/reference/reverse-proxy.md`
- 初始化指引：`docs/guide/init.md`