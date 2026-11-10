export type TimelineUnit = "days" | "weeks" | "months";

export interface PlanPhase {
  name: string;
  percentComplete: number;
  /** AI-estimated calendar weeks for this phase; phases run in order. Absent on plans saved before the calendar existed. */
  durationWeeks?: number;
  tasks: string[];
}

export interface BudgetLine {
  category: string;
  amount: number;
}

export interface MaterialLine {
  material: string;
  category: string;
  qty: number;
  unit: string;
  unitPrice: number;
  /** The real supplier listing this was priced from; 0 / absent = an AI estimate. The backend checks
   * this against the supplier's actual listing, so a linked price is always one a supplier charges. */
  supplierProductId?: number;
  supplierId?: number;
  supplierName?: string;
  /** The phase it's first needed in, so materials can be ordered phase by phase. */
  phase?: string;
}

export interface ClarificationNeeded {
  needsClarification: true;
  questions: string[];
}

export interface ChatReply {
  chatReply: true;
  message: string;
}

export type PlanResult = ConstructionPlan | ClarificationNeeded | ChatReply;

export function isClarificationNeeded(result: PlanResult): result is ClarificationNeeded {
  return (result as ClarificationNeeded).needsClarification === true;
}

export function isChatReply(result: PlanResult): result is ChatReply {
  return (result as ChatReply).chatReply === true;
}

export interface ConstructionPlan {
  projectTitle: string;
  location: string;
  areaSqm: number;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  /** Cars the garage fits; 0 = no garage. Absent on plans saved before garages were planned. */
  garageCars?: number;
  designStyle: string;
  budget: number;
  timelineValue: number;
  timelineUnit: TimelineUnit;
  phases: PlanPhase[];
  budgetBreakdown: BudgetLine[];
  materials: MaterialLine[];
  exteriorConcept: string;
  interiorConcept: string;
  totalEstimate: number;
  /** Which supplier the homeowner chose for each supplier-sourced category. */
  supplierSelections?: SupplierSelections;
}

/** The three plan categories whose materials come from suppliers — the homeowner picks one supplier for each. */
export const SUPPLIER_CATEGORIES = ["Construction Materials", "Electrical and Plumbing", "Finishing Works"] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

/** Supplier id chosen per category; null (or missing) = best price from any supplier. */
export type SupplierSelections = Record<SupplierCategory, number | null>;

/** One supplier that can supply a category, for the picker. */
export interface SupplierOption {
  id: number;
  name: string;
  itemCount: number;
  inStockCount: number;
}

export interface SupplierCategoryOptions {
  category: SupplierCategory;
  suppliers: SupplierOption[];
}
