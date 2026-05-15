import OpenAI from "openai";
import type { Provider, StreamChunk } from "./base.ts";
import type { Message } from "../types.ts";

export class OpenAIProvider implements Provider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async *chatStream(params: {
    model: string;
    messages: Message[];
    tools: any[];
  }): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages: params.messages as any,
      tools: params.tools,
      tool_choice: "auto",
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield { type: "content", delta: delta.content };
      }

      if (delta?.reasoning_content) {
        yield { type: "reasoning", delta: delta.reasoning_content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          yield {
            type: "tool_call",
            delta: "",
            toolCall: {
              index: tc.index ?? 0,
              id: tc.id,
              name: tc.function?.name,
              arguments: tc.function?.arguments,
            },
          };
        }
      }
    }
  }
}
