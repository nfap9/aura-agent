import { describe, it, expect } from "vitest";
import { calculate } from "../native/calculator.js";
import { systemTime } from "../native/systemTime.js";
import { executeBash } from "../native/bash.js";

describe("calculator", () => {
  it("should calculate basic arithmetic", () => {
    expect(calculate({ expression: "2 + 3" })).toBe("2 + 3 = 5");
    expect(calculate({ expression: "10 - 4" })).toBe("10 - 4 = 6");
    expect(calculate({ expression: "3 * 4" })).toBe("3 * 4 = 12");
    expect(calculate({ expression: "15 / 3" })).toBe("15 / 3 = 5");
  });

  it("should handle complex expressions", () => {
    expect(calculate({ expression: "(2 + 3) * 4" })).toBe("(2 + 3) * 4 = 20");
    expect(calculate({ expression: "2^10" })).toBe("2^10 = 1024");
  });

  it("should return error for invalid expressions", () => {
    expect(calculate({ expression: "abc + def" })).toBe("计算错误");
    expect(calculate({ expression: "" })).toBe("计算错误");
  });
});

describe("systemTime", () => {
  it("should return formatted date string", () => {
    const result = systemTime();
    // Format: YYYY-MM-DD HH:MM:SS
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("should return a valid date", () => {
    const result = systemTime();
    const date = new Date(result.replace(" ", "T"));
    expect(date.getTime()).not.toBeNaN();
    expect(date.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("bash", () => {
  it("should execute echo command", async () => {
    const result = await executeBash({ command: "echo hello" });
    expect(result.trim()).toBe("hello");
  });

  it("should handle command with stderr", async () => {
    const result = await executeBash({ command: "echo error >&2; echo ok" });
    expect(result).toContain("ok");
    expect(result).toContain("[stderr]");
  });

  it("should handle invalid command", async () => {
    const result = await executeBash({ command: "this_command_does_not_exist_12345" });
    expect(result).toContain("命令执行失败");
  });

  it("should respect custom timeout", async () => {
    const result = await executeBash({ command: "sleep 0.01 && echo done", timeout: 5000 });
    expect(result.trim()).toBe("done");
  });
});
