import "dotenv/config";
import Chat from "./core/chat.ts";
import { createProvider } from "./core/providers/index.ts";
import { createDefaultRegistry } from "./core/tools/index.ts";
import { ConsoleIO } from "./cli/io.ts";
import { ChatPresets } from "./core/config/index.ts";
import { MemoryManager, FileMemoryStorage } from "./core/memory/index.ts";
import { runChatLoop } from "./cli/index.ts";
import { SYSTEM_PROMPT } from "./core/prompts/index.ts";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const MEMORY_PATH = process.env.MEMORY_PATH || "./data/memories.json";

async function main() {
  const io = new ConsoleIO();

  // 初始化长期记忆
  const memoryStorage = new FileMemoryStorage(MEMORY_PATH);
  const memoryManager = new MemoryManager({
    storage: memoryStorage,
    defaultLimit: 5,
    maxEntries: 500,
  });
  const memoryCount = await memoryManager.getCount();
  io.output(`已加载 ${memoryCount} 条长期记忆\n`);

  const registry = createDefaultRegistry({ memoryManager });
  io.output(
    `已加载 ${registry.count} 个工具: ${registry.listTools().join(", ")}\n`,
  );

  // 初始化模型
  const provider = createProvider(API_FORMAT, API_KEY, BASE_URL);
  const chat = new Chat({
    provider,
    modelName: MODEL_NAME,
    systemPrompt: SYSTEM_PROMPT,
    tools: registry,
    memoryManager,
  });

  io.output(`使用 API 格式: ${API_FORMAT}\n`);

  // 开始对话
  await runChatLoop({ chat, io, preset: ChatPresets.balanced });
}

main();
