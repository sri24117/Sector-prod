import { readFileSync } from "node:fs";
import { join } from "node:path";

// Loads a skill file's raw markdown as context for packages/ai. The skill
// files themselves (/skills/*.md at repo root) are the source of truth for
// domain reasoning — this package is just the loader, it must not
// paraphrase or transform their content in a way that could drift from the
// canonical file.

const SKILLS_ROOT = join(process.cwd(), "..", "..", "skills");

const SKILL_FILES: Record<string, string> = {
  "audit-engine": "audit-engine.md",
  "seo-geo-aio-implementor": "seo-geo-aio-implementor.md",
  "social-content-calendar": "social-content-calendar.md",
  "content-creator-comms": "content-creator-comms.md",
  "brand-visual-designer": "brand-visual-designer.md",
  researcher: "researcher.md",
  "ad-grants": "ad-grants.md",
};

export function loadSkill(skillId: string): string {
  const filename = SKILL_FILES[skillId];
  if (!filename) {
    throw new Error(`Unknown skillId "${skillId}". See packages/skills/src/index.ts.`);
  }
  return readFileSync(join(SKILLS_ROOT, filename), "utf-8");
}

export function listSkillIds(): string[] {
  return Object.keys(SKILL_FILES);
}
