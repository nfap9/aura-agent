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

  async sendMessage(userInput: string): Promise<string> {
    this.messages.push({
      role: "user",
      content: userInput,
    });

    const response = await this.client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: this.messages as any,
      tools: this.tools,
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;

    console.log("message", message);

    if (message?.tool_calls) {
      return await this.handleToolCall(message);
    } else {
      this.messages.push({
        role: "assistant",
        content: message?.content || "",
        reasoning_content: message?.reasoning_content,
      });
      return message?.content || "";
    }
  }

  private async handleToolCall(message: any): Promise<string> {
    this.messages.push({
      role: "assistant",
      content: message.content,
      reasoning_content: message.reasoning_content,
      tool_calls: message.tool_calls,
    });

    for (const toolCall of message.tool_calls) {
      console.log(toolCall.function);

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
      console.log(result);

      this.messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
      });
    }
    const finalResponse = await this.client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: this.messages as any,
      tools: this.tools,
    });

    const finalMessage = finalResponse.choices[0]?.message;

    console.log("finalMessage", finalMessage);

    this.messages.push({
      role: "assistant",
      content: finalMessage?.content || "",
      reasoning_content: finalMessage?.reasoning_content,
    });

    return finalMessage?.content || "";
  }
  getHistory() {
    return [...this.messages];
  }
}
