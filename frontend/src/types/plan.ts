export interface PlanPhase {
  name: string;
  percentComplete: number;
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

export interface EquipmentLine {
  name: string;
  qty: number;
  duration: string;
  cost: number;
  phase: string;
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
  equipment: EquipmentLine[];
  exteriorConcept: string;
  interiorConcept: string;
  totalEstimate: number;
}
