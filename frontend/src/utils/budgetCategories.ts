import type { Ionicons } from "@expo/vector-icons";

export interface BudgetCategoryMeta {
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  color: string;
}

// Must match ConstructionPlanService::BUDGET_CATEGORIES on the backend exactly — the AI is
// constrained to return only these six, each exactly once, so lookups below should always hit.
export const BUDGET_CATEGORIES: BudgetCategoryMeta[] = [
  {
    category: "Foundation and Excavation",
    icon: "layers-outline",
    description: "Excavation, soil preparation, footings, and foundation work.",
    color: "#8b5cf6",
  },
  {
    category: "Construction Materials",
    icon: "cube-outline",
    description: "Cement, sand, gravel, hollow blocks, steel bars, lumber, and roofing materials.",
    color: "#f59e0b",
  },
  {
    category: "Labor Costs",
    icon: "people-outline",
    description: "Payments for masons, carpenters, electricians, plumbers, painters, and other workers.",
    color: "#3b82f6",
  },
  {
    category: "Contractor and Project Management Fee",
    icon: "briefcase-outline",
    description: "Contractor fees, site supervision, and construction coordination.",
    color: "#06b6d4",
  },
  {
    category: "Electrical and Plumbing",
    icon: "flash-outline",
    description: "Wiring, outlets, lighting, water supply, drainage, and plumbing fixtures.",
    color: "#10b981",
  },
  {
    category: "Finishing Works",
    icon: "color-palette-outline",
    description: "Floor tiles, painting, ceilings, doors, windows, cabinets, and other finishes.",
    color: "#f43f5e",
  },
];

const FALLBACK_META: BudgetCategoryMeta = {
  category: "Other",
  icon: "ellipsis-horizontal-outline",
  description: "",
  color: "#9ca3af",
};

/** Looks up a category's display metadata by name (case-insensitive) — falls back gracefully if the AI ever returns something unexpected. */
export function budgetCategoryMeta(category: string): BudgetCategoryMeta {
  const match = BUDGET_CATEGORIES.find((c) => c.category.toLowerCase() === category.toLowerCase());
  return match ?? { ...FALLBACK_META, category };
}
