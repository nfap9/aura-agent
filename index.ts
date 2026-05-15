import "dotenv/config";
import Chat from "./core/chat.ts";
import { createProvider } from "./core/providers/index.ts";
import { createDefaultRegistry } from "./core/tools/index.ts";
import { ConsoleIO } from "./cli/io.ts";
import { ChatPresets } from "./core/config/index.ts";
import { MemoryManager, FileMemoryStorage } from "./core/memory/index.ts";
import { runChatLoop } from "./cli/index.ts";
import { SYSTEM_PROMPT } from "./core/prompts/index.ts";
import { SkillRegistry } from "./core/skills/index.ts";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const MEMORY_PATH = process.env.MEMORY_PATH || "./data/memories.json";
const SKILLS_PATH = process.env.SKILLS_PATH || "";

async function main() {
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

  const registry = createDefaultRegistry({ memoryManager });
  io.info(
    "工具",
    `${registry.count} 个 (${registry.listTools().join(", ")})`,
    "🔧",
  );

  // 初始化 Skill
  let skillRegistry: SkillRegistry | undefined;

  if (SKILLS_PATH) {
    skillRegistry = await SkillRegistry.fromDirectory(SKILLS_PATH, {
      maxActiveSkills: 3,
    });
    io.info(
      "Skills",
      `${skillRegistry.count} 个 (${skillRegistry.listSkills().join(", ")})`,
      "🎯",
    );
  }

  // 初始化模型
  const provider = createProvider(API_FORMAT, API_KEY, BASE_URL);
  const chat = new Chat({
    provider,
    modelName: MODEL_NAME,
    systemPrompt: SYSTEM_PROMPT,
    tools: registry,
    memoryManager,
    skillRegistry,
  });

  io.info("API 格式", API_FORMAT, "⚡");
  io.divider("─", 48);

  // 开始对话
  await runChatLoop({ chat, io, preset: ChatPresets.balanced });
}

main();
