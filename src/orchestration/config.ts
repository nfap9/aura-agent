import type { ChatCompletionOptions } from "../domain/types.ts";

/** 预制模型配置项，可直接作为 options 传入 sendMessage / sendMessageStream */
export const ChatPresets = {
  /** 创意/对话型：较高的 temperature，适合头脑风暴、写作 */
  creative: { temperature: 0.9, top_p: 0.95 } satisfies ChatCompletionOptions,

  /** 平衡型：默认参数，适合一般问答 */
  balanced: { temperature: 0.7, top_p: 1 } satisfies ChatCompletionOptions,

  /** 精确型：低 temperature，适合事实问答、数学、推理 */
  precise: { temperature: 0.2, top_p: 0.5 } satisfies ChatCompletionOptions,

  /** 代码型：低 temperature + JSON 格式，适合结构化代码生成 */
  coding: {
    temperature: 0.1,
    top_p: 0.3,
    response_format: { type: "json_object" },
  } satisfies ChatCompletionOptions,

  /** JSON 输出：强制返回 JSON 对象 */
  json: { response_format: { type: "json_object" } } satisfies ChatCompletionOptions,
};