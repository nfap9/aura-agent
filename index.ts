import "dotenv/config";
import readline from "readline";
import SimpleChat from "./Chat.ts";
import { createProvider } from "./providers/index.ts";
import { createDefaultRegistry } from "./tools/index.ts";

const API_FORMAT = process.env.API_FORMAT || "openai";
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "";

function startLoading(text = "思考中"): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write(`${frames[0]} ${text}...`);
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r${frames[i]} ${text}...`);
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write("\r" + " ".repeat(text.length + 6) + "\r");
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const registry = createDefaultRegistry();
  console.log(`已加载 ${registry.count} 个工具: ${registry.listTools().join(", ")}\n`);

  const provider = createProvider(API_FORMAT, API_KEY, BASE_URL);
  const chat = new SimpleChat(
    provider,
    MODEL_NAME,
    SYSTEM_PROMPT,
    registry,
  );

  console.log(`使用 API 格式: ${API_FORMAT}\n`);
  console.log("开始对话，输入 'exit' 或按 Ctrl+C 退出\n");

  const ask = () =>
    new Promise<string>((resolve) => {
      rl.question("你: ", resolve);
    });

  while (true) {
    const userInput = await ask();
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      rl.close();
      break;
    }

    const stopLoading = startLoading("思考中");
    let isFirstChunk = true;

    process.stdout.write("AI: ");
    for await (const chunk of chat.sendMessage(userInput)) {
      if (isFirstChunk) {
        stopLoading();
        isFirstChunk = false;
      }
      process.stdout.write(chunk);
    }
    console.log("\n");
  }
}

main();
