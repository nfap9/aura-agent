import "dotenv/config";
import { Agent, ChatPresets, SYSTEM_PROMPT } from "./agent/index.ts";
import { createProvider } from "./llm/index.ts";
import { createDefaultRegistry } from "./capabilities/tools/index.ts";
import { ConsoleIO } from "./interfaces/cli/io.ts";

import { MemoryManager, FileMemoryStorage } from "./capabilities/memory/index.ts";
import { runChatLoop } from "./interfaces/cli/index.ts";

import { SkillRegistry } from "./capabilities/skills/index.ts";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const MEMORY_PATH = process.env.MEMORY_PATH || "./data/memories.json";
const SKILLS_PATH = process.env.SKILLS_PATH || "";
const MCP_SERVERS_PATH = process.env.MCP_SERVERS_PATH || "";

export async function bootstrap() {
  const io = new ConsoleIO();

  io.output("");
  io.output("  \x1b[1m\x1b[96m🚀 启动 AI 助手\x1b[0m");
  io.divider("─", 48);

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
