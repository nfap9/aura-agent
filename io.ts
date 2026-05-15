import readline from "readline";

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
}

export class ConsoleIO implements IO {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  output(message: string): void {
    console.log(message);
  }

  write(chunk: string): void {
    process.stdout.write(chunk);
  }

  input(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  debug(message: string): void {
    console.error(`[debug] ${message}`);
  }

  startLoading(text: string = "思考中"): () => void {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    process.stdout.write(`${frames[0]} ${text}...`);
    const timer = setInterval(() => {
      i = (i + 1) % frames.length;
      process.stdout.write(`\r${frames[i]} ${text}...`);
    }, 80);
    return () => {
      clearInterval(timer);
      process.stdout.write("\r" + " ".repeat(text.length + 6) + "\r");
    };
  }

  close(): void {
    this.rl.close();
  }
}
