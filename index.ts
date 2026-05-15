import "dotenv/config";
import SimpleChat from "./Chat.ts";
import { createProvider } from "./providers/index.ts";
import { createDefaultRegistry } from "./tools/index.ts";
import { ConsoleIO } from "./io.ts";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "";

async function main() {
  const io = new ConsoleIO();

  const registry = createDefaultRegistry();
  io.output(`已加载 ${registry.count} 个工具: ${registry.listTools().join(", ")}\n`);

  const provider = createProvider(API_FORMAT, API_KEY, BASE_URL);
  const chat = new SimpleChat(
    provider,
    MODEL_NAME,
    SYSTEM_PROMPT,
    registry,
  );

  io.output(`使用 API 格式: ${API_FORMAT}\n`);
  io.output("开始对话，输入 'exit' 或按 Ctrl+C 退出\n");

  while (true) {
    const userInput = await io.input("你: ");
    if (userInput.trim().toLowerCase() === "exit") {
      io.output("再见！");
      io.close();
      break;
    }

    const stopLoading = io.startLoading("思考中");
    let isFirstChunk = true;

    io.write("AI: ");
    for await (const chunk of chat.sendMessageStream(userInput)) {
      if (isFirstChunk) {
        stopLoading();
        isFirstChunk = false;
      }
      if (chunk.type === "content" || chunk.type === "reasoning") {
        io.write(chunk.delta);
      }
      // tool_call 不输出到终端
    }
    io.output("");
  }
}

main();
