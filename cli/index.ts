import type { IO } from "./io.ts";
import type Chat from "../core/chat.ts";
import type { ChatCompletionOptions } from "../core/types.ts";

export interface ChatLoopOptions {
  chat: Chat;
  io: IO;
  preset?: ChatCompletionOptions;
}

export async function runChatLoop(options: ChatLoopOptions): Promise<void> {
  const { chat, io, preset } = options;

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
    for await (const chunk of chat.sendMessageStream(userInput, preset)) {
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
