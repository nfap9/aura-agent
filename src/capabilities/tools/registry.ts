import type { ToolDefinition, ToolHandler } from "./types.ts";
import type { ChatCompletionTool } from "../../types/types.ts";
import type { ToolSource } from "../../agent/index.ts";

interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry implements ToolSource {
  private tools = new Map<string, Tool>();

  /**
   * 注册一个工具
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.name)) {
      console.warn(`Tool "${definition.name}" already registered, overwriting.`);
    }
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * 获取 OpenAI 格式的 tools schema 数组
   */
  getToolSchemas(): ChatCompletionTool[] {
    return Array.from(this.tools.values()).map((t) => ({
      type: "function" as const,
      function: {
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.definition.parameters,
      },
    }));
  }

  /**
   * 执行指定工具
   */
  async execute(name: string, args: Record<string, any>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      const available = this.listTools().join(", ");
      throw new Error(`Unknown tool: "${name}". Available: ${available}`);
    }
    return await tool.handler(args);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  get count(): number {
    return this.tools.size;
  }
}
