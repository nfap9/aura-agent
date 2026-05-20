# Aura

一个轻量、模块化、可扩展的 AI Agent 运行时框架。

Aura 采用 **ReAct**（推理+行动）模式，将大语言模型与工具、记忆、技能无缝融合，让 Agent 能够自主思考、调用工具、积累知识并持续进化。

---

## ✨ 核心特性

- **🧠 ReAct 智能循环** — 自动推理与工具调用，支持多轮迭代，最大可配置 10 轮深度思考
- **🔌 多模型支持** — 统一 Provider 抽象，兼容 OpenAI、Anthropic、Gemini 及所有 OpenAI 格式接口（如 DeepSeek）
- **🛠️ 工具生态**
  - 内置工具：Bash 执行、计算器、系统时间、记忆管理
  - **MCP 协议** — 通过 Model Context Protocol 连接任意外部工具服务器（stdio / HTTP）
- **🧠 长期记忆** — 基于相似度检索的记忆系统，自动合并重复内容，支持重要性评分与智能清理
- **🎯 动态技能** — 从 `SKILL.md` 文件自动加载技能，运行时语义匹配注入上下文
- **💬 交互式 CLI** — 流式输出、思考过程可视化、工具调用实时展示
- **⚙️ 对话预设** — 创意、平衡、精确、代码、JSON 等多种生成参数一键切换

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────┐
│           CLI / 交互界面                 │
├─────────────────────────────────────────┤
│  Agent（ReAct 循环 · 上下文编排 · 流式）  │
├──────────┬──────────────┬───────────────┤
│  LLM   │  Tools       │  Memory       │
│ Provider │ · Native     │ Manager       │
│          │ · MCP        │ · FileStore   │
├──────────┴──────────────┴───────────────┤
│           Skill Registry                │
│      （SKILL.md · 语义匹配）             │
└─────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
API_FORMAT=openai
API_KEY=your-api-key
BASE_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o

# 可选：长期记忆存储路径
MEMORY_PATH=./data/memories.json

# 可选：Skill 目录路径
# SKILLS_PATH=./skills

# 可选：MCP 服务器配置文件
# MCP_SERVERS_PATH=./mcp.json
```

### 3. 启动对话

```bash
npm run dev:cli
# 或构建后运行
npm run build
node apps/cli/dist/index.js
```

输入 `exit` 或按 `Ctrl+C` 退出。

---

## 📁 项目结构（Monorepo）

```
├── packages/
│   └── core/            # @aura/core — Agent 引擎（可独立发布）
│       ├── src/
│       │   ├── agent/   # Agent 核心：ReAct 循环、对话线程、配置
│       │   ├── llm/     # 大模型 Provider（OpenAI / Anthropic / Gemini）
│       │   ├── capabilities/  # 能力层：工具、记忆、技能
│       │   └── types/   # 类型定义
│       └── package.json
├── apps/
│   └── cli/             # @aura/cli — 命令行交互界面
│       ├── src/
│       │   ├── interfaces/cli/  # CLI 交互循环
│       │   └── bootstrap.ts
│       └── package.json
├── data/                # 默认记忆存储目录
├── package.json         # Workspace 根配置
└── tsconfig.json        # 共享 TypeScript 配置
```

### 添加新产品

```bash
# 创建 API 服务
cd apps
mkdir api
cd api
npm init -y
# package.json 中添加 "@aura/core": "*" 依赖

# 创建桌面端 / Web 端同理
```

---

## 🔧 进阶配置

### MCP 服务器示例（`mcp.json`）

```json
{
  "servers": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/data"]
    }
  ]
}
```

### Skill 文件示例（`skills/web-search/SKILL.md`）

```markdown
---
name: web-search
description: 网络搜索技能，帮助用户查找最新信息
---

## 使用场景

当用户询问实时信息、新闻、股价等需要联网查询的内容时，主动调用搜索工具。

## 搜索策略

1. 提取关键词
2. 使用 search_web 工具
3. 综合结果回答用户
```

---

## 🛠️ 内置工具

| 工具 | 描述 |
|------|------|
| `bash` | 执行本地 Shell 命令 |
| `calculator` | 数学表达式计算 |
| `systemTime` | 获取当前系统时间 |
| `memory_save` | 保存信息到长期记忆 |
| `memory_search` | 检索相关记忆 |
| `memory_delete` | 删除指定记忆 |

---

## 📦 技术栈

- **TypeScript** — 类型安全的现代 JavaScript
- **Node.js** — 运行时环境（ES Modules）
- **Zod** — 运行时类型校验
- **MCP SDK** — Model Context Protocol 官方 SDK

---

## 📄 License

ISC
