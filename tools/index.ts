import { ToolRegistry } from "./registry.ts";
import { weatherDefinition, getWeather } from "./weather.ts";
import { calculatorDefinition, calculate } from "./calculator.ts";

export type { ToolDefinition, ToolHandler } from "./types.ts";
export { ToolRegistry } from "./registry.ts";

/**
 * 创建包含默认工具的注册表
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(weatherDefinition, (args) => getWeather(args));
  registry.register(calculatorDefinition, (args) => calculate(args));
  return registry;
}
