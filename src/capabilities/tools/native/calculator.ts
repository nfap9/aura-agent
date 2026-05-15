import type { ToolDefinition } from "../types.ts";

export const calculatorDefinition: ToolDefinition = {
  name: "calculate",
  description: "执行数学计算",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: '数学表达式，如 "2 + 3 * 4"',
      },
    },
    required: ["expression"],
  },
};

export function calculate(args: Record<string, any>): string {
  const { expression } = args;
  try {
    // 生产环境建议使用更安全的方式，如 math.js 的 evaluate
    const result = eval(expression);
    return `${expression} = ${result}`;
  } catch {
    return "计算错误";
  }
}
