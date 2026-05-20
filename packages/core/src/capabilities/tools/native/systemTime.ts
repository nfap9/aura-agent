import type { ToolDefinition } from "../types.js";

export const systemTimeDefinition: ToolDefinition = {
  name: "system_time",
  description: "获取用户当地时间",
  parameters: {
    type: "null",
    properties: {},
    required: [],
  },
};

export function systemTime(): string {
  try {
    const now = new Date();
    const formattedDate = `${
      now.getFullYear() // 年
    }-${
      String(now.getMonth() + 1).padStart(2, "0") // 月
    }-${
      String(now.getDate()).padStart(2, "0") // 日
    } ${
      String(now.getHours()).padStart(2, "0") // 时
    }:${
      String(now.getMinutes()).padStart(2, "0") // 分
    }:${
      String(now.getSeconds()).padStart(2, "0") // 秒
    }`;
    return formattedDate;
  } catch {
    return "获取时间失败";
  }
}
