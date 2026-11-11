export interface ContractorCompletedProject {
  id: number;
  title: string;
  homeownerName: string;
  status: "completed";
  startedAt: string | null;
  completedAt: string | null;
}

export interface ContractorCompletedDetails extends ContractorCompletedProject {
  budget: number | null;
  location: string | null;
  projectType: string | null;
  description: string | null;
  finalReportAvailable: false;
}
