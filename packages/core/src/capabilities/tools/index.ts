import { ToolRegistry } from "./registry.js";
import { calculatorDefinition, calculate } from "./native/calculator.js";
import { createMemoryTools } from "./memory-tool.js";
import type { MemoryManager } from "../memory/manager.js";
import { systemTime, systemTimeDefinition } from "./native/systemTime.js";
import { bashDefinition, executeBash } from "./native/bash.js";
import { MCPClientManager, type MCPConfig } from "./mcp.js";

export type { ToolDefinition, ToolHandler } from "./types.js";
export { ToolRegistry } from "./registry.js";
export { MCPClientManager } from "./mcp.js";

export interface RegistryOptions {
  /** 长期记忆管理器，传入后注册 memory_* 工具 */
  memoryManager?: MemoryManager;
  /** MCP 配置，传入后连接 MCP 服务器并注册其工具 */
  mcpConfig?: MCPConfig;
}

/**
 * 创建包含默认工具的注册表
 */
export async function createDefaultRegistry(options: RegistryOptions = {}): Promise<ToolRegistry> {
  const registry = new ToolRegistry();
  registry.register(calculatorDefinition, (args) => calculate(args));
  registry.register(systemTimeDefinition, () => systemTime());
  registry.register(bashDefinition, (args) => executeBash(args));

  if (options.memoryManager) {
    const memoryTools = createMemoryTools(options.memoryManager);
    for (const def of memoryTools.definitions) {
      const handler = memoryTools.handlers[def.name as keyof typeof memoryTools.handlers];
      registry.register(def, (args) => handler(args));
    }
  }

  if (options.mcpConfig) {
    const mcpManager = new MCPClientManager();
    await mcpManager.connect(options.mcpConfig);
    for (const def of mcpManager.getToolDefinitions()) {
      const handlers = mcpManager.getToolHandlers();
      const handler = handlers[def.name];
      if (handler) {
        registry.register(def, handler);
      }
    }
  }

  return registry;
}
