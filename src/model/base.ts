import type { Message, ChatCompletionOptions, ChatCompletionTool } from "../types/types.ts";

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
    tools: ChatCompletionTool[];
    options?: ChatCompletionOptions;
  }): AsyncGenerator<StreamChunk>;
}
