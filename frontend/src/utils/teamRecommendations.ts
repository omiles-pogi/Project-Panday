import type { ConstructionPlan } from "@/types/plan";

/** Budget categories that map to a trade/skill a homeowner would search for — "Construction
 * Materials", "Labor Costs", and the management fee aren't trades in themselves, so they're
 * left out rather than guessed at. */
const CATEGORY_SKILLS: Record<string, string[]> = {
  "Foundation and Excavation": ["Excavation", "Foundation", "Masonry"],
  "Electrical and Plumbing": ["Electrical", "Plumbing"],
  "Finishing Works": ["Painting", "Tiling", "Carpentry"],
};

const STOPWORDS = new Set(["and", "the", "of", "for", "to", "a", "an", "work", "works", "phase"]);

/**
 * Derives a skills list from the AI-generated plan's budget categories and phase names, used to
 * drive the same rule-based worker/contractor search with project-specific criteria instead of an
 * empty, generic browse — this is what makes "Find Your Team" show AI-suggested matches.
 */
export function recommendedSkillsForPlan(plan: ConstructionPlan): string[] {
  const fromCategories = plan.budgetBreakdown.flatMap((b) => CATEGORY_SKILLS[b.category] ?? []);
  const fromPhases = plan.phases.flatMap((p) =>
    p.name
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, ""))
      .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()))
  );
  return Array.from(new Set([...fromCategories, ...fromPhases]));
}
