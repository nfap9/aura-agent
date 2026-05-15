import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { Skill } from "./types.ts";

/**
 * 简单 YAML frontmatter 解析器
 * 支持 `key: value` 形式，value 可多行（以空格缩进续行）
 */
function parseFrontmatter(text: string): {
  metadata: Record<string, any>;
  body: string;
} {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: text.trim() };
  }

  const yamlText = match[1]!;
  const body = match[2]!.trim();
  const metadata: Record<string, any> = {};

  const lines = yamlText.split(/\r?\n/);
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      if (currentKey) metadata[currentKey] = currentValue.trim();
      currentKey = kv[1]!;
      currentValue = kv[2]!;
    } else if (currentKey && /^\s/.test(line)) {
      currentValue += "\n" + line.trim();
    }
  }
  if (currentKey) metadata[currentKey] = currentValue.trim();

  return { metadata, body };
}

/**
 * 从单个 SKILL.md 文件加载 Skill
 */
export async function loadSkillFromFile(filePath: string): Promise<Skill> {
  const raw = await fs.readFile(filePath, "utf-8");
  const { metadata, body } = parseFrontmatter(raw);

  const name = String(metadata.name ?? path.basename(path.dirname(filePath)));
  const description = String(metadata.description ?? "");

  return {
    name,
    description,
    content: body,
    metadata,
    sourcePath: filePath,
  };
}

/**
 * 扫描目录，加载所有子目录下的 SKILL.md
 */
function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * 扫描目录，加载所有子目录下的 SKILL.md
 */
export async function loadSkillsFromDirectory(
  dirPath: string,
): Promise<Skill[]> {
  const skills: Skill[] = [];
  const resolvedPath = expandHome(dirPath);

  try {
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(resolvedPath, entry.name, "SKILL.md");
      try {
        const skill = await loadSkillFromFile(skillFile);
        skills.push(skill);
      } catch {
        // 该目录下没有 SKILL.md，跳过
      }
    }
  } catch {
    // 目录不存在或无法读取，返回空数组
  }

  return skills;
}
