import type { Message } from "./types.ts";
import type { Provider } from "./providers/index.ts";
import { ToolRegistry } from "./tools/registry.ts";

const MAX_ITERATIONS = 10;
const DEFAULT_MAX_CONTEXT_TOKENS = 6000;

export default class Chat {
  private messages: Message[] = [];
  private provider: Provider;
  private tools: ToolRegistry;
  private modelName: string;
  private maxContextTokens: number;

  constructor(
    provider: Provider,
    modelName: string,
    systemPrompt: string,
    tools: ToolRegistry,
    maxContextTokens?: number,
  ) {
    this.provider = provider;
    this.modelName = modelName;
    this.tools = tools;
    this.maxContextTokens = maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    this.messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  // ========== Token 估算与截断 ==========

  private estimateTokens(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return chineseChars + Math.ceil(otherChars / 4);
  }

  private estimateMessageTokens(msg: Message): number {
    let tokens = 4;
    tokens += this.estimateTokens(msg.content || "");
    tokens += this.estimateTokens(msg.reasoning_content || "");
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        tokens += this.estimateTokens(tc.function.name);
        tokens += this.estimateTokens(tc.function.arguments);
        tokens += 4;
      }
    }
    if (msg.role === "tool") tokens += 2;
    return tokens;
  }

  private trimHistory() {
    let totalTokens = 0;
    for (const msg of this.messages) {
      totalTokens += this.estimateMessageTokens(msg);
    }
    if (totalTokens <= this.maxContextTokens) return;

    let startIndex = this.messages[0]?.role === "system" ? 1 : 0;
    const minKeepCount = 2;

    while (
      totalTokens > this.maxContextTokens &&
      this.messages.length - startIndex > minKeepCount
    ) {
      const removed = this.messages[startIndex]!;
      totalTokens -= this.estimateMessageTokens(removed);
      this.messages.splice(startIndex, 1);
    }
    // trimHistory 静默执行，不输出任何信息
  }

  // ========== 核心对话逻辑 ==========

  async *sendMessage(userInput: string): AsyncGenerator<string> {
    this.messages.push({ role: "user", content: userInput });
    this.trimHistory();

    let continueLoop = true;
    let iteration = 0;

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;

      const stream = this.provider.chatStream({
        model: this.modelName,
        messages: this.messages,
        tools: this.tools.getOpenAISchemas(),
      });

      let content = "";
      let reasoningContent = "";
      const toolCalls: any[] = [];
      let hasToolCall = false;

      for await (const chunk of stream) {
        if (chunk.type === "content") {
          content += chunk.delta;
          yield chunk.delta;
        } else if (chunk.type === "reasoning") {
          reasoningContent += chunk.delta;
          yield chunk.delta;
        } else if (chunk.type === "tool_call") {
          hasToolCall = true;
          const { index, id, name, arguments: args } = chunk.toolCall!;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          if (id) toolCalls[index].id += id;
          if (name) toolCalls[index].function.name += name;
          if (args) toolCalls[index].function.arguments += args;
        }
      }

      this.messages.push({
        role: "assistant",
        content,
        reasoning_content: reasoningContent || undefined,
        tool_calls: hasToolCall ? toolCalls : undefined,
      } as any);

      if (!hasToolCall) {
        continueLoop = false;
      } else {
        for (const toolCall of toolCalls) {
          const { name, arguments: args } = toolCall.function;
          const parseArgs = JSON.parse(args);
          let result: string;

          try {
            result = await this.tools.execute(name, parseArgs);
          } catch (err: any) {
            result = `工具执行错误: ${err.message}`;
          }

          this.messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
        }
      }

      if (iteration >= MAX_ITERATIONS && hasToolCall) {
        yield "\n[到达最大请求次数，已停止]";
        continueLoop = false;
      }
    }
  }

  getHistory() {
    return [...this.messages];
  }
}
