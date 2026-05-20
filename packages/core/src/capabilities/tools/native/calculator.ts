import { Parser } from "expr-eval";
import type { ToolDefinition } from "../types.js";

export const calculatorDefinition: ToolDefinition = {
  name: "calculate",
  description: "执行数学计算，支持加、减、乘、除、取模、括号、幂运算",
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
    const result = Parser.evaluate(expression);
    return `${expression} = ${result}`;
  } catch {
    return "计算错误";
  }
}
