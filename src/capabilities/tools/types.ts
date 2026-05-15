/**
 * 工具定义（描述信息，会被转成 OpenAI function schema）
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * 工具执行函数签名
 */
export type ToolHandler = (args: Record<string, any>) => Promise<string> | string;
