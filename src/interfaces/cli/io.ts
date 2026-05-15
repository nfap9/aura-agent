import readline from "readline";

// ANSI 颜色码
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  brightGreen: "\x1b[92m",
  cyan: "\x1b[36m",
  brightCyan: "\x1b[96m",
  yellow: "\x1b[33m",
  brightYellow: "\x1b[93m",
  blue: "\x1b[34m",
  brightBlue: "\x1b[94m",
  magenta: "\x1b[35m",
  brightMagenta: "\x1b[95m",
  red: "\x1b[31m",
};

export interface IO {
  /** 输出给用户（实际输入输出） */
  output(message: string): void;
  /** 流式写入，不换行（实际输入输出） */
  write(chunk: string): void;
  /** 获取用户输入（实际输入输出） */
  input(prompt: string): Promise<string>;
  /** 调试日志（非用户交互） */
  debug(message: string): void;
  /** 开始加载动画，返回停止函数 */
  startLoading(text?: string): () => void;
  /** 输出分隔线 */
  divider(char?: string, width?: number): void;
  /** 输出带样式的系统信息 */
  info(label: string, value: string, icon?: string): void;
  /** 显示工具调用 */
  showToolCall(name: string, args: Record<string, any>): void;
  /** 显示工具执行结果 */
  showToolResult(name: string, result: string): void;
  /** 显示工具执行错误 */
  showToolError(name: string, error: string): void;
  /** 显示匹配到的 Skills */
  showSkills(skills: { name: string; description: string }[]): void;
  /** 关闭 IO 资源 */
  close(): void;
}

export class ConsoleIO implements IO {
  private rl: readline.Interface;
  private isClosing = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 优雅处理 Ctrl+C
    this.rl.on("SIGINT", () => {
      if (this.isClosing) return;
      this.isClosing = true;
      this.output(`\n${C.gray}👋 再见！${C.reset}`);
      this.close();
      process.exit(0);
    });
  }

  output(message: string): void {
    console.log(message + C.reset);
  }

  write(chunk: string): void {
    process.stdout.write(chunk);
  }

  input(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  debug(message: string): void {
    console.error(`${C.gray}[debug] ${message}${C.reset}`);
  }

  startLoading(text: string = "思考中"): () => void {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const prefix = `${C.yellow}${frames[0]}${C.reset}`;
    const suffix = `${C.gray}${text}...${C.reset}`;
    this.write(`\r${prefix} ${suffix}`);
    const timer = setInterval(() => {
      i = (i + 1) % frames.length;
      const p = `${C.yellow}${frames[i]}${C.reset}`;
      this.write(`\r${p} ${suffix}`);
    }, 80);
    return () => {
      clearInterval(timer);
      this.write(`\r${" ".repeat(text.length + 8)}\r`);
    };
  }

  divider(char: string = "─", width: number = 48): void {
    this.output(`${C.dim}${char.repeat(width)}${C.reset}`);
  }

  info(label: string, value: string, icon: string = "◆"): void {
    this.output(
      `${C.dim}${icon}${C.reset} ${C.bold}${label}:${C.reset} ${C.brightCyan}${value}${C.reset}`,
    );
  }

  showToolCall(name: string, _args: Record<string, any>): void {
    this.output(`${C.yellow}🔧 调用工具:${C.reset} ${C.brightYellow}${name}${C.reset}`);
  }

  showToolResult(_name: string, _result: string): void {
    // 不显示结果详情
  }

  showToolError(name: string, _error: string): void {
    this.output(
      `${C.red}❌ 工具错误:${C.reset} ${C.brightYellow}${name}${C.reset}`,
    );
  }

  showSkills(skills: { name: string; description: string }[]): void {
    for (const skill of skills) {
      this.output(
        `${C.magenta}🎯 使用技能:${C.reset} ${C.brightMagenta}${skill.name}${C.reset}`,
      );
    }
  }

  close(): void {
    this.rl.close();
  }
}
