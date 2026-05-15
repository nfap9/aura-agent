import { exec } from "child_process";
import { promisify } from "util";
import type { ToolDefinition } from "./types.ts";

const execAsync = promisify(exec);

export const bashDefinition: ToolDefinition = {
  name: "bash",
  description:
    "执行 shell 命令。用于运行系统命令、调用 CLI 工具（如 agent-browser）、文件操作等。注意：不要执行会删除用户数据或破坏系统的危险命令。",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的 shell 命令",
      },
      timeout: {
        type: "number",
        description: "命令超时时间（毫秒），默认 60 秒",
      },
    },
    required: ["command"],
  },
};

export async function executeBash(
  args: Record<string, any>,
): Promise<string> {
  const { command, timeout = 60000 } = args;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    let result = "";
    if (stdout) result += stdout;
    if (stderr) result += "\n[stderr]\n" + stderr;
    return result || "(命令执行完成，无输出)";
  } catch (error: any) {
    let msg = `命令执行失败: ${error.message}`;
    if (error.stdout) msg += "\n[stdout]\n" + error.stdout;
    if (error.stderr) msg += "\n[stderr]\n" + error.stderr;
    return msg;
  }
}
