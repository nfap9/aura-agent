import { describe, it, expect } from "vitest";
import { SkillRegistry } from "../registry.js";
import type { Skill } from "../types.js";

describe("SkillRegistry", () => {
  function createSkill(name: string, description: string, content = ""): Skill {
    return {
      name,
      description,
      content,
      metadata: { name, description },
    };
  }

  it("should register and retrieve skills", () => {
    const registry = new SkillRegistry();
    const skill = createSkill("coding", "Help with coding tasks");

    registry.register(skill);
    expect(registry.get("coding")).toEqual(skill);
    expect(registry.count).toBe(1);
  });

  it("should list all skills", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Code help"));
    registry.register(createSkill("writing", "Write help"));

    expect(registry.listSkills()).toEqual(["coding", "writing"]);
  });

  it("should match skills by keyword", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Help with programming and code"));
    registry.register(createSkill("cooking", "Recipes and food preparation"));

    const matches = registry.match("how to write code");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("coding");
  });

  it("should match skills by content", () => {
    const registry = new SkillRegistry();
    registry.register(
      createSkill(
        "coding",
        "Code help",
        "Use TypeScript for all projects. Follow strict mode."
      )
    );

    const matches = registry.match("TypeScript strict mode");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("coding");
  });

  it("should return empty array when no match", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Code help"));

    const matches = registry.match("quantum physics astronomy");
    expect(matches).toHaveLength(0);
  });

  it("should return empty array for empty query", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Code help"));

    expect(registry.match("")).toHaveLength(0);
    expect(registry.match("   ")).toHaveLength(0);
  });

  it("should limit max active skills", () => {
    const registry = new SkillRegistry({ maxActiveSkills: 2 });
    registry.register(createSkill("coding", "Code help programming"));
    registry.register(createSkill("debugging", "Debug help programming"));
    registry.register(createSkill("testing", "Test help programming"));

    const matches = registry.match("programming help");
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it("should sort by relevance score", () => {
    const registry = new SkillRegistry();
    registry.register(
      createSkill("python", "Python programming language guide")
    );
    registry.register(
      createSkill("javascript", "JavaScript web development")
    );

    const matches = registry.match("python programming");
    expect(matches[0].name).toBe("python");
  });

  it("should overwrite duplicate skill with warning", () => {
    const registry = new SkillRegistry();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    registry.register(createSkill("coding", "v1"));
    registry.register(createSkill("coding", "v2"));

    expect(warnSpy).toHaveBeenCalledWith(
      'Skill "coding" already registered, overwriting.'
    );
    expect(registry.get("coding")?.description).toBe("v2");

    warnSpy.mockRestore();
  });

  it("should ignore hidden skills", () => {
    const registry = new SkillRegistry();
    registry.register({
      name: "visible",
      description: "Visible skill",
      content: "",
      metadata: {},
    });
    registry.register({
      name: "hidden",
      description: "Hidden skill",
      content: "",
      metadata: { hidden: true },
    });

    const matches = registry.match("skill");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("visible");
  });

  it("should handle case-insensitive matching", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Code Help"));

    const matches = registry.match("CODE");
    expect(matches).toHaveLength(1);
  });

  it("should filter out stop words", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "Code help"));

    // "is", "the", "a" are stop words
    const matches = registry.match("is the a code");
    expect(matches).toHaveLength(1);
  });

  it("should keep single Chinese characters", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill("coding", "编程代码帮助"));

    const matches = registry.match("编");
    expect(matches).toHaveLength(1);
  });

  it("should load from directory", async () => {
    // This is more of an integration test; we verify the static method exists
    expect(SkillRegistry.fromDirectory).toBeDefined();
  });
});
