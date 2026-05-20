import type { ChatCompletionTool } from "../../types/types.ts";

export interface ToolSource {
  getToolSchemas(): ChatCompletionTool[];
  execute(name: string, args: Record<string, any>): Promise<string>;
}

export class NullToolSource implements ToolSource {
  getToolSchemas() {
    return [];
  }
  execute(): Promise<string> {
    return Promise.resolve("");
  }
}
