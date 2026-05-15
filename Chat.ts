import OpenAI from "openai";
import type { Message } from "./types.ts";
import { calculate, getWeather } from "./tools/utils.ts";

const MAX_ITERATIONS = 10;
export default class Chat {
  private messages: Message[] = [];
  private client: OpenAI;
  private tools: any[];
  private modelName: string;

  constructor(
    apiKey: string,
    baseURL: string,
    modelName: string,
    systemPrompt: string,
    tools: any,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.modelName = modelName;
    this.tools = tools;
    this.messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  async *sendMessage(userInput: string): AsyncGenerator<string> {
    this.messages.push({
      role: "user",
      content: userInput,
    });

    let continueLoop = true;
    let iteration = 0;
    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++
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

      // 生成消息并组装
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
      this.messages.push({
        role: "assistant",
        content,
        reasoning_content: reasoningContent || undefined,
        tool_calls: hasToolCall ? toolCalls : undefined,
      } as any);

      if (!hasToolCall) {
        continueLoop = false;
      } else {
        this.messages.push({
          role: "assistant",
          content,
          reasoning_content: reasoningContent || undefined,
          tool_calls: toolCalls,
        });

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

      if(iteration >= MAX_ITERATIONS && hasToolCall){
        yield "\n[到达最大请求次数，已停止]"
      }
    }
  }

  getHistory() {
    return [...this.messages];
  }
}
