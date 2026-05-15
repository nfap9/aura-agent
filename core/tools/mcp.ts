import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ToolDefinition, ToolHandler } from "./types.ts";

export interface MCPServerConfig {
  /** 服务器名称，用于区分不同来源的工具 */
  name: string;
  /** 传输方式 */
  transport: "stdio" | "http" | "https";
  /** stdio 传输：可执行文件路径 */
  command?: string;
  /** stdio 传输：命令参数 */
  args?: string[];
  /** stdio 传输：环境变量 */
  env?: Record<string, string>;
  /** stdio 传输：工作目录 */
  cwd?: string;
  /** http/https 传输：服务器 URL */
  url?: string;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}

interface ServerConnection {
  config: MCPServerConfig;
  client: Client;
  transport: Transport;
  tools: ToolDefinition[];
}

/**
 * MCP 客户端管理器：连接多个 MCP 服务器，将其工具统一暴露为本地 ToolDefinition
 */
export class MCPClientManager {
  private connections: Map<string, ServerConnection> = new Map();
  private _toolServerMap: Map<string, string> = new Map();

  /**
   * 连接所有配置的 MCP 服务器
   */
  async connect(config: MCPConfig): Promise<void> {
    for (const serverConfig of config.servers) {
      try {
        await this.connectServer(serverConfig);
      } catch (err) {
        console.error(`[MCP] 连接服务器 "${serverConfig.name}" 失败:`, err);
      }
    }
  }

  /**
   * 连接单个 MCP 服务器
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    const client = new Client(
      { name: "agent-mcp-client", version: "1.0.0" },
      { capabilities: {} },
    );

    let transport: Transport;

    if (config.transport === "stdio") {
      if (!config.command) {
        throw new Error(`MCP server "${config.name}" 缺少 command 配置`);
      }
      const stdioParams: { command: string; args?: string[]; env?: Record<string, string>; cwd?: string } = {
        command: config.command,
      };
      if (config.args !== undefined) stdioParams.args = config.args;
      if (config.env !== undefined) stdioParams.env = config.env;
      if (config.cwd !== undefined) stdioParams.cwd = config.cwd;
      transport = new StdioClientTransport(stdioParams as any);
    } else if (config.transport === "http" || config.transport === "https") {
      if (!config.url) {
        throw new Error(`MCP server "${config.name}" 缺少 url 配置`);
      }
      transport = new StreamableHTTPClientTransport(new URL(config.url)) as Transport;
    } else {
      throw new Error(`不支持的 MCP 传输方式: ${(config as any).transport}`);
    }

    await client.connect(transport);

    // 获取工具列表
    const toolsResult = await client.listTools();
    const tools: ToolDefinition[] = toolsResult.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      parameters: {
        type: "object",
        properties: (t.inputSchema.properties ?? {}) as Record<string, any>,
        required: t.inputSchema.required ?? [],
      },
    }));

    const connection: ServerConnection = {
      config,
      client,
      transport,
      tools,
    };

    this.connections.set(config.name, connection);

    for (const tool of tools) {
      const uniqueName = this.makeUniqueToolName(config.name, tool.name);
      this._toolServerMap.set(uniqueName, config.name);
    }

    console.log(
      `[MCP] 已连接 "${config.name}"，发现 ${tools.length} 个工具`,
    );
  }

  /**
   * 生成唯一工具名，避免不同服务器之间的命名冲突
   */
  private makeUniqueToolName(serverName: string, toolName: string): string {
    return `${serverName}_${toolName}`;
  }

  /**
   * 获取所有 MCP 工具的定义（已添加服务器前缀避免冲突）
   */
  getToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const [serverName, conn] of this.connections) {
      for (const tool of conn.tools) {
        defs.push({
          name: this.makeUniqueToolName(serverName, tool.name),
          description: `[${serverName}] ${tool.description}`,
          parameters: tool.parameters,
        });
      }
    }
    return defs;
  }

  /**
   * 获取所有 MCP 工具的 handler
   */
  getToolHandlers(): Record<string, ToolHandler> {
    const handlers: Record<string, ToolHandler> = {};

    for (const uniqueName of this._toolServerMap.keys()) {
      handlers[uniqueName] = async (args: Record<string, any>) => {
        return await this.executeTool(uniqueName, args);
      };
    }

    return handlers;
  }

  /**
   * 执行指定 MCP 工具
   */
  private async executeTool(
    uniqueName: string,
    args: Record<string, any>,
  ): Promise<string> {
    const serverName = this._toolServerMap.get(uniqueName);
    if (!serverName) {
      throw new Error(`未知的 MCP 工具: ${uniqueName}`);
    }

    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`MCP 服务器 "${serverName}" 未连接`);
    }

    const originalToolName = uniqueName.slice(serverName.length + 1);

    const result = await conn.client.callTool({
      name: originalToolName,
      arguments: args,
    });

    // 处理工具返回结果
    if ("content" in result && Array.isArray(result.content)) {
      const texts = result.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      if (texts) return texts;

      const resources = result.content
        .filter((c: any) => c.type === "resource")
        .map((c: any) => {
          if ("text" in c.resource) return c.resource.text;
          if ("blob" in c.resource) return `[binary data: ${c.resource.uri}]`;
          return JSON.stringify(c.resource);
        })
        .join("\n");
      if (resources) return resources;

      const images = result.content
        .filter((c: any) => c.type === "image")
        .map((c: any) => `[image data: ${c.mimeType}]`)
        .join("\n");
      if (images) return images;

      return JSON.stringify(result.content);
    }

    if ("toolResult" in result) {
      return JSON.stringify(result.toolResult);
    }

    return JSON.stringify(result);
  }

  /**
   * 获取所有已连接的服务器名称
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 获取工具总数
   */
  get toolCount(): number {
    return this._toolServerMap.size;
  }

  /**
   * 断开所有 MCP 服务器连接
   */
  async disconnect(): Promise<void> {
    for (const [name, conn] of this.connections) {
      try {
        await conn.transport.close();
        console.log(`[MCP] 已断开 "${name}"`);
      } catch (err) {
        console.error(`[MCP] 断开 "${name}" 时出错:`, err);
      }
    }
    this.connections.clear();
    this._toolServerMap.clear();
  }
}
