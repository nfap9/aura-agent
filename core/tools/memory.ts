import type { ToolDefinition } from "./types.ts";
import type { MemoryManager } from "../memory/manager.ts";

/**
 * 创建记忆管理工具集（依赖外部的 MemoryManager 实例）
 */
export function createMemoryTools(manager: MemoryManager) {
  const saveMemoryDefinition: ToolDefinition = {
    name: "memory_save",
    description:
      "将重要信息保存到长期记忆中，以便将来对话时回忆。" +
      "适用于：用户偏好、关键事实、重要事件、对话总结等。" +
      "不要保存临时性、无关紧要的信息。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "要保存的记忆内容，简洁明确，一两句话为佳",
        },
        category: {
          type: "string",
          enum: ["fact", "preference", "event", "summary"],
          description: "记忆类别：fact(事实), preference(偏好), event(事件), summary(总结)",
        },
        importance: {
          type: "number",
          description: "重要程度 1-10，10 为极其重要",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["content"],
    },
  };

  const searchMemoryDefinition: ToolDefinition = {
    name: "memory_search",
    description:
      "从长期记忆中搜索与用户查询相关的历史信息。" +
      "当你觉得需要了解用户的背景、历史偏好或之前的事件时调用。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词或句子",
        },
        limit: {
          type: "number",
          description: "最多返回几条记忆，默认 5 条",
          minimum: 1,
          maximum: 20,
        },
      },
      required: ["query"],
    },
  };

  const deleteMemoryDefinition: ToolDefinition = {
    name: "memory_delete",
    description: "删除一条长期记忆。当用户要求遗忘某条信息，或发现记忆错误时使用。",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "记忆的唯一 ID",
        },
      },
      required: ["id"],
    },
  };

  const listMemoryDefinition: ToolDefinition = {
    name: "memory_list",
    description: "列出当前保存的所有长期记忆。",
    parameters: {
      type: "object",
      properties: {},
    },
  };

  async function saveMemory(args: Record<string, any>): Promise<string> {
    const entry = await manager.saveMemory(
      args.content,
      args.category ?? "fact",
      args.importance ?? 5,
    );
    return `已保存记忆 [${entry.id}]（${entry.category}，重要度 ${entry.importance}）`;
  }

  async function searchMemory(args: Record<string, any>): Promise<string> {
    const results = await manager.searchMemories(args.query, args.limit ?? 5);
    if (results.length === 0) {
      return "未找到相关记忆。";
    }
    return results
      .map(
        (r) =>
          `• [${r.entry.id}] (${r.entry.category}, 重要度 ${r.entry.importance}) ${r.entry.content}`,
      )
      .join("\n");
  }

  async function deleteMemory(args: Record<string, any>): Promise<string> {
    const success = await manager.deleteMemory(args.id);
    return success ? "已删除记忆。" : `未找到 ID 为 ${args.id} 的记忆。`;
  }

  async function listMemory(): Promise<string> {
    const entries = await manager.listMemories();
    if (entries.length === 0) {
      return "当前没有保存任何记忆。";
    }
    return entries
      .map(
        (e) =>
          `• [${e.id}] (${e.category}, 重要度 ${e.importance}) ${e.content}`,
      )
      .join("\n");
  }

  return {
    definitions: [
      saveMemoryDefinition,
      searchMemoryDefinition,
      deleteMemoryDefinition,
      listMemoryDefinition,
    ],
    handlers: {
      memory_save: saveMemory,
      memory_search: searchMemory,
      memory_delete: deleteMemory,
      memory_list: listMemory,
    },
  };
}
