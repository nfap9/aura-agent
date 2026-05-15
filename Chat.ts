import OpenAI from "openai";
import type { Message } from "./types.ts";
import { calculate, getWeather } from "./tools/utils.ts";

const MAX_ITERATIONS = 10;

// 默认最大上下文 token 数（可根据模型调整：4k/8k/16k/32k/128k）
const DEFAULT_MAX_CONTEXT_TOKENS = 6000;

export default class Chat {
  private messages: Message[] = [];
  private client: OpenAI;
  private tools: any[];
  private modelName: string;
  private maxContextTokens: number;

  constructor(
    apiKey: string,
    baseURL: string,
    modelName: string,
    systemPrompt: string,
    tools: any,
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

  /**
   * 粗略估算文本的 token 数
   * 中文：1 字 ≈ 1 token
   * 英文/符号/数字：4 字符 ≈ 1 token
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return chineseChars + Math.ceil(otherChars / 4);
  }

  /**
   * 估算单条消息的 token 数（包含 content、reasoning_content、tool_calls）
   */
  private estimateMessageTokens(msg: Message): number {
    let tokens = 4; // 角色标记等固定开销

    tokens += this.estimateTokens(msg.content || "");
    tokens += this.estimateTokens(msg.reasoning_content || "");

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        tokens += this.estimateTokens(tc.function.name);
        tokens += this.estimateTokens(tc.function.arguments);
        tokens += 4; // 单个 tool_call 开销
      }
    }

    if (msg.role === "tool") {
      tokens += 2; // tool 结果额外开销
    }

    return tokens;
  }

  /**
   * 滑动窗口截断：保留 system prompt，从旧到新丢弃消息直到满足 token 限制。
   * 策略：始终保留 system prompt + 最近至少一轮对话（user + assistant）。
   */
  private trimHistory() {
    let totalTokens = 0;
    for (const msg of this.messages) {
      totalTokens += this.estimateMessageTokens(msg);
    }

    if (totalTokens <= this.maxContextTokens) {
      return; // 未超限，无需截断
    }

    // system prompt 固定保留
    let startIndex = 0;
    if (this.messages[0]?.role === "system") {
      startIndex = 1;
    }

    // 至少保留最近一轮对话：user + assistant（2 条）
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
      `[trimHistory] 截断后剩余 ${this.messages.length} 条消息，` +
        `估算 token: ${totalTokens}/${this.maxContextTokens}`
    );
  }

  async *sendMessage(userInput: string): AsyncGenerator<string> {
    this.messages.push({
      role: "user",
      content: userInput,
    });

    // 每次新用户消息到达后截断历史
    this.trimHistory();

    let continueLoop = true;
    let iteration = 0;

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`\n----第${iteration}轮请求----`);

      const stream = await this.client.chat.completions.create({
        model: this.modelName,
        messages: this.messages as any,
        tools: this.tools,
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
            if (tc.function?.name) {
              toolCalls[index].function.name += tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCalls[index].function.arguments += tc.function.arguments;
            }
          }
        }
      }

      // 保存 assistant 本轮回复（含工具调用请求或最终答案）
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
          switch (name) {
            case "get_weather":
              result = await getWeather(parseArgs.city);
              break;
            case "calculate":
              result = calculate(parseArgs.expression);
              break;
            default:
              result = "未知工具";
          }
          console.log(`\n工具生成#${toolCall.id}：${result}`);

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
