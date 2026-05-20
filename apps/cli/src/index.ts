import "dotenv/config";
import {
  Agent,
  ChatPresets,
  SYSTEM_PROMPT,
  createProvider,
  createDefaultRegistry,
  MemoryManager,
  FileMemoryStorage,
  SkillRegistry,
} from "@aura/core";
import { ConsoleIO } from "./interfaces/cli/io.js";
import { runChatLoop } from "./interfaces/cli/index.js";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const MEMORY_PATH = process.env.MEMORY_PATH || "./data/memories.json";
const SKILLS_PATH = process.env.SKILLS_PATH || "";
const MCP_SERVERS_PATH = process.env.MCP_SERVERS_PATH || "";

async function main() {
  const io = new ConsoleIO();

  io.output("");
  io.output("  \x1b[1m\x1b[96m🚀 启动 AI 助手\x1b[0m");
  io.divider("─", 48);

  // 检查必需配置
  const missing: string[] = [];
  if (!API_KEY) missing.push("API_KEY");
  if (!BASE_URL) missing.push("BASE_URL");
  if (!MODEL_NAME) missing.push("MODEL_NAME");

  if (missing.length > 0) {
    io.output(`\x1b[93m⚠️ 缺少必需配置项: ${missing.join(", ")}\x1b[0m`);
    io.output("");
    io.output("请复制 .env.example 为 .env 并填写以下信息：");
    io.output("");
    io.output("  \x1b[90mcp .env.example .env\x1b[0m");
    io.output("");
    io.output("然后在 .env 中设置：");
    io.output("");
    io.output("  \x1b[1mAPI_KEY\x1b[0m=你的 API 密钥");
    io.output("  \x1b[1mBASE_URL\x1b[0m=https://api.openai.com/v1");
    io.output("  \x1b[1mMODEL_NAME\x1b[0m=gpt-4o");
    io.output("");
    io.close();
    process.exit(1);
  }

  // 初始化长期记忆
  const memoryStorage = new FileMemoryStorage(MEMORY_PATH);
  const memoryManager = new MemoryManager({
    storage: memoryStorage,
    defaultLimit: 5,
    maxEntries: 500,
  });
  const memoryCount = await memoryManager.getCount();
  io.info("长期记忆", `${memoryCount} 条`, "🧠");

  // 加载 MCP 配置（如果存在）
  let mcpConfig = undefined;
  if (MCP_SERVERS_PATH) {
    try {
      const mcpData = await import(MCP_SERVERS_PATH, { with: { type: "json" } });
      mcpConfig = mcpData.default || mcpData;
    } catch {
      try {
        const { readFile } = await import("node:fs/promises");
        const raw = await readFile(MCP_SERVERS_PATH, "utf-8");
        mcpConfig = JSON.parse(raw);
      } catch (err: any) {
        console.warn(`[MCP] 加载配置文件失败: ${err.message}`);
      }
    }
  }

  const registry = await createDefaultRegistry({ memoryManager, mcpConfig });
  io.info("工具", `${registry.count} 个 (${registry.listTools().join(", ")})`, "🔧");

  // 初始化 Skill
  let skillRegistry: SkillRegistry | undefined;

  if (SKILLS_PATH) {
    skillRegistry = await SkillRegistry.fromDirectory(SKILLS_PATH, {
      maxActiveSkills: 3,
    });
    io.info("Skills", `${skillRegistry.count} 个 (${skillRegistry.listSkills().join(", ")})`, "🎯");
  }

  // 初始化模型
  const provider = createProvider(API_FORMAT, API_KEY, BASE_URL);
  const agent = new Agent({
    provider,
    model: MODEL_NAME,
    systemPrompt: SYSTEM_PROMPT,
    tools: registry,
    memory: memoryManager,
    skills: skillRegistry,
  });

  io.info("API 格式", API_FORMAT, "⚡");
  io.divider("─", 48);

  // 开始对话
  await runChatLoop({ chat: agent, io, preset: ChatPresets.balanced });
}

main().catch((err) => {
  console.error("\x1b[31m❌ 程序发生错误:\x1b[0m", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
