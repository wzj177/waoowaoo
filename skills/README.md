# waoowaoo Skills — 独立 MCP 技能服务

本目录是一个**独立的 MCP 技能服务（Standalone MCP Skills Server）**，可与 [openClaw](https://github.com/openclaw) 等支持 MCP 协议的 AI 客户端配合使用，用于操控 waoowaoo AI 短剧视频制作工作流。

---

## 功能（工具列表）

| 工具名称 | 描述 |
|---|---|
| `list_projects` | 列出指定用户的所有项目（支持分页） |
| `get_project_workflow_status` | 查询项目在 11 个制作阶段的进度，返回百分比和下一步建议 |
| `create_project` | 创建一个新的短剧项目 |

---

## 核心制作流程（11 个阶段）

`get_project_workflow_status` 工具会检查以下阶段：

1. **剧集文本** — 是否已导入小说/剧本文本
2. **角色** — 是否已提取角色列表
3. **场景** — 是否已提取场景列表
4. **角色图像** — 是否已为所有角色生成 AI 形象
5. **场景图像** — 是否已为所有场景生成环境图
6. **分镜** — 是否已完成故事→剧本→分镜转换
7. **分镜图像** — 是否已渲染所有分镜画面
8. **配音台词** — 是否已提取台词列表
9. **配音音频** — 是否已生成所有配音
10. **视频片段** — 是否已合成所有视频片段
11. **最终视频** — 是否已合成剧集完整视频

---

## 安装与启动

### 1. 安装依赖

```bash
cd skills
npm install
```

### 2. 配置环境变量

复制 `.env.example` 并填入真实值：

```bash
cp .env.example .env
```

必填项：

| 变量名 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接字符串，与 waoowaoo 主应用使用同一数据库 |
| `WAOOWAOO_USER_ID` | 要查询的用户 ID（从 waoowaoo 数据库 `users` 表获取） |

> **提示**：如何找到 `WAOOWAOO_USER_ID`？登录 waoowaoo 后，在数据库 `users` 表中查找你的账号对应的 `id` 字段。

### 3. 编译 TypeScript

```bash
npm run build
```

### 4. 启动 MCP 服务

```bash
npm start
```

---

## 在 openClaw 中配置

在 openClaw 的 MCP 服务器配置文件（通常为 `claude_desktop_config.json` 或 `mcp_settings.json`）中添加：

```json
{
  "mcpServers": {
    "waoowaoo": {
      "command": "node",
      "args": ["/path/to/waoowaoo/skills/dist/index.js"],
      "env": {
        "DATABASE_URL": "mysql://user:password@localhost:3306/waoowaoo",
        "WAOOWAOO_USER_ID": "your-user-id-here"
      }
    }
  }
}
```

---

## 开发模式

无需编译，直接使用 `tsx` 运行：

```bash
npm run dev
```

---

## 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk@1.26.0`（无已知漏洞）
- **数据库**: `mysql2`（直连 waoowaoo 的 MySQL 数据库）
- **运行时**: Node.js ≥ 18.18.0
- **语言**: TypeScript
