export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  reasoning_content?: string | undefined;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON字符串
  };
}
