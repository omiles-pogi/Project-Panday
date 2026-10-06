export interface ContractorProfile {
  company_name: string | null;
  specialization: string;
  years_experience: number;
  bio: string | null;
  skills: { skill: string }[];
}

export interface ContractorSearchResult {
  id: number;
  name: string;
  email: string;
  companyName: string | null;
  specialization: string;
  yearsExperience: number;
  bio: string | null;
  skills: string[];
  averageRating: number | null;
  ratingCount: number;
  matchedSkillCount: number;
  score: number;
}

export interface ContractorRatingEntry {
  score: number;
  comment: string | null;
  raterName: string;
  createdAt: string;
}

export interface ContractorPublicProfile {
  id: number;
  name: string;
  companyName: string | null;
  specialization: string | null;
  yearsExperience: number | null;
  bio: string | null;
  skills: string[];
  averageRating: number | null;
  ratingCount: number;
  ratings: ContractorRatingEntry[];
}
