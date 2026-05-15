import { ToolRegistry } from "./registry.ts";
import { calculatorDefinition, calculate } from "./calculator.ts";
import { createMemoryTools } from "./memory.ts";
import type { MemoryManager } from "../memory/manager.ts";
import { systemTime, systemTimeDefinition } from "./systemTime.ts";
import { bashDefinition, executeBash } from "./bash.ts";

export type { ToolDefinition, ToolHandler } from "./types.ts";
export { ToolRegistry } from "./registry.ts";

export interface RegistryOptions {
  /** 长期记忆管理器，传入后注册 memory_* 工具 */
  memoryManager?: MemoryManager;
}

/**
 * 创建包含默认工具的注册表
 */
export function createDefaultRegistry(
  options: RegistryOptions = {},
): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(calculatorDefinition, (args) => calculate(args));
  registry.register(systemTimeDefinition, () => systemTime());
  registry.register(bashDefinition, (args) => executeBash(args));

  if (options.memoryManager) {
    const memoryTools = createMemoryTools(options.memoryManager);
    for (const def of memoryTools.definitions) {
      const handler =
        memoryTools.handlers[def.name as keyof typeof memoryTools.handlers];
      registry.register(def, (args) => handler(args));
    }
  }

  return registry;
}
