export interface PlanPhase {
  name: string;
  percentComplete: number;
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
  designStyle: string;
  budget: number;
  timelineMonths: number;
  phases: PlanPhase[];
  budgetBreakdown: BudgetLine[];
  materials: MaterialLine[];
  exteriorConcept: string;
  interiorConcept: string;
  totalEstimate: number;
}
