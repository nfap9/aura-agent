export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  reasoning_content?: string | undefined;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON字符串
  };
}

/** Tokenizer 抽象，允许接入 tiktoken 等精确分词器 */
export interface Tokenizer {
  encode(text: string): number[];
}

/** 生成参数，透传给 Provider */
export interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  reasoning_effort?: "low" | "medium" | "high";
  /** 允许透传 provider 特有参数 */
  [key: string]: any;
}

/** Skill 匹配信息 */
export interface MatchedSkill {
  name: string;
  description: string;
}

/** 生命周期事件回调 */
export interface AgentEvents {
  onIterationStart?: (iteration: number, messages: Message[]) => void;
  onIterationEnd?: (iteration: number, assistantMessage: Message) => void;
  onContentChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onToolCallStart?: (toolCall: ToolCall) => void;
  onToolCallEnd?: (toolCall: ToolCall, result: string) => void;
  onToolCallError?: (toolCall: ToolCall, error: Error) => void;
  onSkillMatch?: (skills: MatchedSkill[]) => void;
}

/** 非流式调用返回结果 */
export interface AgentResult {
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  /** 包含本次交互后的完整历史 */
  messages: Message[];
}
