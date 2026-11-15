import type { WorkerSearchResult } from "@/types/worker";
import type { ContractorSearchResult } from "@/types/contractor";

export type DirectoryPerson = WorkerSearchResult | ContractorSearchResult;
export type WorkerFilters = { type: "worker" | "contractor"; specialty: string; skills: string[]; minRate: string; maxRate: string };
export const emptyWorkerFilters = (type: WorkerFilters["type"] = "worker"): WorkerFilters => ({ type, specialty: "", skills: [], minRate: "", maxRate: "" });
const unique = (values: string[]) => [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()];

export function workerFilterOptions(people: DirectoryPerson[]) {
  return {
    specialties: unique(people.map(person => "trade" in person ? person.trade : person.specialization).filter(value => !!value && value.length <= 100)).sort((a, b) => a.localeCompare(b)),
    skills: unique(people.flatMap(person => person.skills).filter(value => value.length <= 50)).sort((a, b) => a.localeCompare(b)),
  };
}

export function normalizeWorkerFilters(filters: WorkerFilters): WorkerFilters {
  return { ...filters, specialty: filters.specialty.trim(), skills: unique(filters.skills.map(value => value.trim())),
    minRate: filters.type === "worker" ? filters.minRate.trim() : "", maxRate: filters.type === "worker" ? filters.maxRate.trim() : "" };
}

export function validateWorkerFilters(filters: WorkerFilters): string | null {
  if (filters.specialty.length > 100 || filters.skills.length > 20 || filters.skills.some(value => !value || value.length > 50)) return "Choose up to 20 supported skills or services.";
  if (filters.type === "contractor") return null;
  for (const value of [filters.minRate, filters.maxRate]) {
    if (value && (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > Number.MAX_SAFE_INTEGER)) return "Enter positive peso amounts, with up to two decimal places.";
  }
  if (filters.minRate && filters.maxRate && Number(filters.minRate) > Number(filters.maxRate)) return "Minimum Rate must not exceed Maximum Rate.";
  return null;
}

/** Existing endpoints accept specialty/skills, not rates or fabricated availability. */
export function workerFilterQuery(type: WorkerFilters["type"], filters: WorkerFilters | null) {
  const current = filters?.type === type ? filters : null;
  return type === "worker" ? { trade: current?.specialty || undefined, skills: current?.skills ?? [] }
    : { specialization: current?.specialty || undefined, skills: current?.skills ?? [] };
}

export function matchesWorkerFilters(person: DirectoryPerson, query: string, filters: WorkerFilters | null) {
  const type = "trade" in person ? "worker" : "contractor";
  const specialty = "trade" in person ? person.trade : person.specialization;
  const words = [person.name, specialty, ...person.skills, ...("companyName" in person ? [person.companyName ?? ""] : [])].join(" ").toLowerCase();
  if (!words.includes(query.trim().toLowerCase())) return false;
  if (!filters) return true;
  if (filters.type !== type || !specialty.toLowerCase().includes(filters.specialty.toLowerCase())) return false;
  if (!filters.skills.every(skill => person.skills.some(actual => actual.toLowerCase() === skill.toLowerCase()))) return false;
  if (type === "worker" && (filters.minRate || filters.maxRate)) {
    const rate = (person as WorkerSearchResult).minDailyWage;
    // Unknown asking rates stay unknown; never treat a missing rate as zero.
    if (rate == null || !Number.isFinite(rate) || filters.minRate && rate < Number(filters.minRate) || filters.maxRate && rate > Number(filters.maxRate)) return false;
  }
  return true;
}

export const workerFilterCount = (filters: WorkerFilters | null) => filters ? 1 + Number(!!filters.specialty) + filters.skills.length + Number(!!filters.minRate) + Number(!!filters.maxRate) : 0;
