import type { IO } from "./io.ts";
import type Chat from "../core/chat.ts";
import type { ChatCompletionOptions, ChatEvents } from "../core/types.ts";

export interface ChatLoopOptions {
  chat: Chat;
  io: IO;
  preset?: ChatCompletionOptions;
}

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  brightGreen: "\x1b[92m",
  brightCyan: "\x1b[96m",
  brightYellow: "\x1b[93m",
  brightMagenta: "\x1b[95m",
};

export async function runChatLoop(options: ChatLoopOptions): Promise<void> {
  const { chat, io, preset } = options;

  io.output("");
  io.output(
    `${C.dim}╭${"─".repeat(46)}╮${C.reset}`,
  );
  io.output(
    `${C.dim}│${C.reset}  ${C.brightCyan}${C.bold}🤖 AI 助手${C.reset}${" ".repeat(36)}${C.dim}│${C.reset}`,
  );
  io.output(
    `${C.dim}│${C.reset}  ${C.gray}输入 'exit' 或按 Ctrl+C 退出${C.reset}${" ".repeat(18)}${C.dim}│${C.reset}`,
  );
  io.output(
    `${C.dim}╰${"─".repeat(46)}╯${C.reset}`,
  );
  io.output("");

  while (true) {
    const userInput = await io.input(`${C.brightGreen}✦ 你:${C.reset} `);
    if (userInput.trim().toLowerCase() === "exit") {
      io.output(`${C.gray}👋 再见！${C.reset}`);
      io.close();
      break;
    }

    if (userInput.trim() === "") {
      continue;
    }

    io.output("");
    const stopLoading = io.startLoading("思考中");
    let isFirstChunk = true;
    let hasReasoning = false;
    let aiPrefixShown = false;
    let toolCallPending = false;

    const events: ChatEvents = {
      onSkillMatch: (skills) => {
        io.showSkills(skills);
      },
      onToolCallStart: (toolCall) => {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, any>;
        io.showToolCall(toolCall.function.name, args);
      },
      onToolCallEnd: (toolCall, result) => {
        io.showToolResult(toolCall.function.name, result);
      },
      onToolCallError: (toolCall, error) => {
        io.showToolError(toolCall.function.name, error.message);
      },
    };

    for await (const chunk of chat.sendMessageStream(userInput, preset, events)) {
      if (isFirstChunk) {
        stopLoading();
        isFirstChunk = false;
      }
      if (chunk.type === "reasoning") {
        if (!hasReasoning) {
          hasReasoning = true;
          if (aiPrefixShown) {
            io.output("");
          }
          io.write(`${C.gray}  💭 `);
        }
        io.write(chunk.delta);
      } else if (chunk.type === "content") {
        if (hasReasoning) {
          hasReasoning = false;
          io.output(`${C.reset}`);
        }
        if (!aiPrefixShown) {
          io.write(`${C.brightCyan}● AI:${C.reset} `);
          aiPrefixShown = true;
        }
        io.write(chunk.delta);
      } else if (chunk.type === "tool_call") {
        if (!toolCallPending) {
          toolCallPending = true;
          if (hasReasoning) {
            hasReasoning = false;
            io.output(`${C.reset}`);
          }
          io.output(`${C.gray}  🔧 准备调用工具...${C.reset}`);
        }
      }
    }
    io.output(`${C.reset}`);
    io.output("");
  }
}
