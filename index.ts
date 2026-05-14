import dotenv from "dotenv";
import readline from "readline";
import SimpleChat from "./Chat.ts";
import { tools } from "./tools/index.ts";

dotenv.config();

const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "";
const MODEL_NAME = process.env.MODEL_NAME || "";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "";

/** 启动一个旋转 loading 动画，返回一个用于停止的函数 */
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
    // 用空格覆盖掉 loading 行，并将光标移回行首
    process.stdout.write("\r" + " ".repeat(text.length + 6) + "\r");
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const chat = new SimpleChat(
    API_KEY,
    BASE_URL,
    MODEL_NAME,
    SYSTEM_PROMPT,
    tools,
  );

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
    // 每次完整回复后换行，空一行再进入下一轮
    console.log("\n");
  }
}

main();
