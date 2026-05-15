import OpenAI from "openai";
import type { Provider, StreamChunk } from "./base.ts";
import type { Message, ChatCompletionOptions } from "../domain/types.ts";

export class OpenAIProvider implements Provider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async *chatStream(params: {
    model: string;
    messages: Message[];
    tools: any[];
    options?: ChatCompletionOptions;
  }): AsyncGenerator<StreamChunk> {
    const requestOptions: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: params.model,
      messages: params.messages as any,
      tools: params.tools,
      tool_choice: params.options?.tool_choice ?? "auto",
      stream: true,
    };

    // 透传标准参数
    if (params.options?.temperature !== undefined) {
      requestOptions.temperature = params.options.temperature;
    }
    if (params.options?.max_tokens !== undefined) {
      requestOptions.max_tokens = params.options.max_tokens;
    }
    if (params.options?.top_p !== undefined) {
      requestOptions.top_p = params.options.top_p;
    }
    if (params.options?.stop !== undefined) {
      requestOptions.stop = params.options.stop;
    }
    if (params.options?.response_format !== undefined) {
      requestOptions.response_format = params.options.response_format;
    }
    if (params.options?.reasoning_effort !== undefined) {
      (requestOptions as any).reasoning_effort = params.options.reasoning_effort;
    }

    // 透传其他 provider 特有参数（覆盖已有字段时以额外参数为准）
    for (const [key, value] of Object.entries(params.options ?? {})) {
      if (
        key !== "temperature" &&
        key !== "max_tokens" &&
        key !== "top_p" &&
        key !== "stop" &&
        key !== "tool_choice" &&
        key !== "response_format" &&
        key !== "reasoning_effort"
      ) {
        (requestOptions as any)[key] = value;
      }
    }

    const stream = await this.client.chat.completions.create(requestOptions);

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
