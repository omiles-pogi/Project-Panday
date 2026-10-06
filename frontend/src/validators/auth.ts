// Client-side pre-checks only — the backend (RegisterRequest/LoginRequest) is the
// source of truth for validation. These just let the UI disable submit / show a hint
// before making a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

// Matches the backend's Password::min(8) rule.
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidLoginForm(email: string, password: string): boolean {
  return isValidEmail(email) && password.length > 0;
}

// Roles an admin must verify, and what each must submit (mirrors RegisterRequest).
export const VERIFICATION_FIELDS: Record<
  string,
  { businessLabel?: string; licenseLabel: string; licenseHint: string }
> = {
  contractor: {
    businessLabel: "Company / business name",
    licenseLabel: "Contractor license no. (PCAB / PRC)",
    licenseHint: "e.g. PCAB-12345",
  },
  supplier: {
    businessLabel: "Business name",
    licenseLabel: "Business permit / TIN",
    licenseHint: "e.g. 123-456-789-000",
  },
  worker: {
    licenseLabel: "Skill certificate no. (TESDA) or valid ID no.",
    licenseHint: "e.g. TESDA NC II certificate number",
  },
};

export function isValidRegisterForm(fields: {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  role?: string;
  businessName?: string;
  licenseNumber?: string;
}): boolean {
  const verification = fields.role ? VERIFICATION_FIELDS[fields.role] : undefined;
  if (verification) {
    if (verification.businessLabel && !(fields.businessName ?? "").trim()) return false;
    if ((fields.licenseNumber ?? "").trim().length < 4) return false;
  }

  return (
    fields.name.trim().length > 0 &&
    isValidEmail(fields.email) &&
    isValidPassword(fields.password) &&
    fields.password === fields.passwordConfirmation
  );
}
