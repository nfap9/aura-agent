import type { Message, ChatCompletionOptions } from "../types/types.ts";

export interface StreamChunk {
  type: "content" | "reasoning" | "tool_call";
  delta: string;
  toolCall?: {
    index: number;
    id?: string | undefined;
    name?: string | undefined;
    arguments?: string | undefined;
  };
}

export interface Provider {
  chatStream(params: {
    model: string;
    messages: Message[];
    tools: any[];
    options?: ChatCompletionOptions;
  }): AsyncGenerator<StreamChunk>;
}
