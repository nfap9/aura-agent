import OpenAI from "openai";
import type { Message } from "./types.ts";
import { ToolRegistry } from "./tools/registry.ts";

const MAX_ITERATIONS = 10;
const DEFAULT_MAX_CONTEXT_TOKENS = 6000;

export default class Chat {
  private messages: Message[] = [];
  private client: OpenAI;
  private tools: ToolRegistry;
  private modelName: string;
  private maxContextTokens: number;

  constructor(
    apiKey: string,
    baseURL: string,
    modelName: string,
    systemPrompt: string,
    tools: ToolRegistry,
    maxContextTokens?: number,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
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

    console.log(
      `[trimHistory] ${this.messages.length} msgs, ~${totalTokens}/${this.maxContextTokens} tokens`
    );
  }

  // ========== 核心对话逻辑 ==========

  async *sendMessage(userInput: string): AsyncGenerator<string> {
    this.messages.push({ role: "user", content: userInput });
    this.trimHistory();

    let continueLoop = true;
    let iteration = 0;

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`\n----第${iteration}轮请求----`);

      const stream = await this.client.chat.completions.create({
        model: this.modelName,
        messages: this.messages as any,
        tools: this.tools.getOpenAISchemas(),
        tool_choice: "auto",
        stream: true,
      });

      let content = "";
      let reasoningContent = "";
      const toolCalls: any[] = [];
      let hasToolCall = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          yield delta.content;
        }

        if (delta?.reasoning_content) {
          reasoningContent += delta.reasoning_content;
          yield delta.reasoning_content;
        }

        if (delta?.tool_calls) {
          hasToolCall = true;
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: "",
                type: "function",
                function: { name: "", arguments: "" },
              };
            }
            if (tc.id) toolCalls[index].id += tc.id;
            if (tc.function?.name) toolCalls[index].function.name += tc.function.name;
            if (tc.function?.arguments) {
              toolCalls[index].function.arguments += tc.function.arguments;
            }
          }
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

          console.log(`\n工具[${name}]→ ${result}`);

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
