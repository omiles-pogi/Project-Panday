export class PlannerRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly requestId?: string, public readonly status?: number) {
    super(message);
    this.name = "PlannerRequestError";
  }
}

export function logPlannerFailure(code: string, requestId: string, started: number, status?: number) {
  // Never log messages, plans, provider bodies, auth headers or API keys.
  console.warn("PandAI request failed", { category: code, requestId, status, elapsedMs: Date.now() - started });
}
