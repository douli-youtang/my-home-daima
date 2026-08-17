# 扫码填表系统（Nuxt 3 + 小米风格）

Vue 3 / Nuxt 3 + Element Plus（小米橙主题）+ Prisma / MySQL。

## 启动

需要 Node.js 20+（本环境可用 `~/.local/node`）：

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev
```

默认监听 `0.0.0.0:8080`。

- 管理后台：`/login`
- 作业端：`/worker/login`
- 扫码填表：`/scan?scene=点位码`

## 技术栈

- Nuxt 3 + Vue 3 + Element Plus
- Nitro `server/api`（兼容原 `/api/*` 契约）
- Prisma + MySQL + S3 OSS
