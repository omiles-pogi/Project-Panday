export interface WorkerProfile {
  trade: string;
  years_experience: number;
  bio: string | null;
  skills: { skill: string }[];
}

export interface WorkerSearchResult {
  id: number;
  name: string;
  email: string;
  trade: string;
  yearsExperience: number;
  bio: string | null;
  skills: string[];
  averageRating: number | null;
  ratingCount: number;
  matchedSkillCount: number;
  score: number;
}

export interface WorkerRatingEntry {
  score: number;
  comment: string | null;
  raterName: string;
  createdAt: string;
}

export interface WorkerPublicProfile {
  id: number;
  name: string;
  trade: string | null;
  yearsExperience: number | null;
  bio: string | null;
  skills: string[];
  averageRating: number | null;
  ratingCount: number;
  ratings: WorkerRatingEntry[];
}
