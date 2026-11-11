export interface WorkerCompletedProject {
  id: number;
  title: string;
  homeownerName: string;
  workerRole: string | null;
  status: "completed";
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkerCompletedDetails extends WorkerCompletedProject {
  location: string | null;
  projectType: string | null;
  description: string | null;
}
