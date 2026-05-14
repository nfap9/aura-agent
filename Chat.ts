import OpenAI from "openai";
import type { Message } from "./types.ts";
import { calculate, getWeather } from "./tools/utils.ts";

export default class Chat {
  private messages: Message[] = [];
  private client: OpenAI;
  private tools: any[];

  constructor(
    apiKey: string,
    baseURL: string,
    systemPrompt: string,
    tools: any,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.tools = tools;
    this.messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  /**
   * 发送用户消息并以流式方式返回模型响应。
   *
   * 整体流程：
   * 1. 将用户消息加入对话历史。
   * 2. 向模型发起流式请求（stream: true）。
   * 3. 逐块读取响应：
   *    - 普通内容（content）和推理内容（reasoning_content）实时 yield 给调用方。
   *    - 若包含工具调用（tool_calls），则在流结束后收集完整的工具参数。
   * 4. 如有工具调用：
   *    - 将模型产生的 tool_calls 加入历史。
   *    - 按顺序执行每个工具，并将结果以 role="tool" 写入历史。
   *    - 再次发起流式请求获取最终回复，并实时 yield。
   * 5. 将最终的 assistant 消息保存到历史。
   *
   * @param userInput - 用户输入的文本
   */
  async *sendMessage(userInput: string): AsyncGenerator<string> {
    // 1. 保存用户消息到对话历史
    this.messages.push({
      role: "user",
      content: userInput,
    });

    // 2. 发起第一次流式请求
    const stream = await this.client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: this.messages as any,
      tools: this.tools,
      tool_choice: "auto",
      stream: true,
    });

    let content = "";
    let reasoningContent = "";
    const toolCalls: any[] = [];
    let hasToolCall = false;

    // 3. 逐块消费流式响应
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // 3.1 普通回复内容：实时输出并累积
      if (delta?.content) {
        content += delta.content;
        yield delta.content;
      }

      // 3.2 推理内容（如 DeepSeek / mimo 的 thinking 过程）：实时输出并累积
      if (delta?.reasoning_content) {
        reasoningContent += delta.reasoning_content;
        yield delta.reasoning_content;
      }

      // 3.3 工具调用片段：按 index 聚合，因为流式下参数会分多次到达
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

    // 4. 如果模型要求调用工具
    if (hasToolCall) {
      // 4.1 将 assistant 的工具调用请求加入历史
      this.messages.push({
        role: "assistant",
        content,
        reasoning_content: reasoningContent || undefined,
        tool_calls: toolCalls,
      });

      // 4.2 按顺序执行工具函数，并将结果写入历史
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

        this.messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        });
      }

      // 4.3 再次发起流式请求，获取工具执行后的最终回复
      const finalStream = await this.client.chat.completions.create({
        model: "mimo-v2.5-pro",
        messages: this.messages as any,
        tools: this.tools,
        stream: true,
      });

      content = "";
      reasoningContent = "";

      for await (const chunk of finalStream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          yield delta.content;
        }

        if (delta?.reasoning_content) {
          reasoningContent += delta.reasoning_content;
          yield delta.reasoning_content;
        }
      }

      // 5. 保存最终 assistant 消息到历史
      this.messages.push({
        role: "assistant",
        content,
        reasoning_content: reasoningContent || undefined,
      });
    } else {
      // 无工具调用时，直接保存 assistant 的回复到历史
      this.messages.push({
        role: "assistant",
        content,
        reasoning_content: reasoningContent || undefined,
      });
    }
  }

  getHistory() {
    return [...this.messages];
  }
}
