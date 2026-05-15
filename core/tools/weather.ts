import type { ToolDefinition } from "./types.ts";

export const weatherDefinition: ToolDefinition = {
  name: "get_weather",
  description: "获取指定城市的天气信息",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "城市名称",
      },
    },
    required: ["city"],
  },
};

export async function getWeather(args: Record<string, any>): Promise<string> {
  const { city } = args;
  const weatherData: Record<string, string> = {
    北京: "晴天，25°C",
    上海: "多云，22°C",
    广州: "雨天，28°C",
  };

  return weatherData[city] || "未知城市";
}
