// Client-side pre-checks only — the backend (RegisterRequest/LoginRequest) is the
// source of truth for validation. These just let the UI disable submit / show a hint
// before making a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_WHITESPACE_MESSAGE = "Passwords cannot contain spaces or whitespace characters.";
/** Match AccountPasswordRules exactly, including Unicode whitespace and invisible separators. */
export function hasPasswordWhitespace(value: string): boolean {
  return /[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/u.test(value);
}

/** Reject the entire edit/paste. Never trim, strip or normalize an authentication secret. */
export function passwordInputChange(previous: string, next: string, legacy = false) {
  const accepted = legacy || !hasPasswordWhitespace(next);
  return { accepted, value: accepted ? next : previous, error: accepted ? null : PASSWORD_WHITESPACE_MESSAGE };
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export type ValidationState = "neutral" | "invalid" | "valid";

/** Match Laravel's character count and explicit ASCII letter/digit policy. Never trim passwords. */
export function passwordRequirements(password: string) {
  return [
    { label: "At least 8 characters", met: Array.from(password).length >= 8, error: "Password must be at least 8 characters." },
    { label: "A letter (A–Z or a–z)", met: /[A-Za-z]/.test(password), error: "Password must contain at least one letter (A-Z or a-z)." },
    { label: "A number (0–9)", met: /[0-9]/.test(password), error: "Password must contain at least one number (0-9)." },
    { label: "No spaces or whitespace", met: !hasPasswordWhitespace(password), error: PASSWORD_WHITESPACE_MESSAGE },
  ];
}

export function passwordError(password: string): string | null {
  if (hasPasswordWhitespace(password)) return PASSWORD_WHITESPACE_MESSAGE;
  return passwordRequirements(password).find(requirement => !requirement.met)?.error ?? null;
}

export function confirmationError(password: string, confirmation: string): string | null {
  if (hasPasswordWhitespace(confirmation)) return PASSWORD_WHITESPACE_MESSAGE;
  return password !== confirmation ? "Passwords do not match." : passwordError(confirmation);
}

export function passwordState(password: string, attempted = false): ValidationState {
  return !password && !attempted ? "neutral" : isValidPassword(password) ? "valid" : "invalid";
}

export function confirmationState(password: string, confirmation: string, attempted = false): ValidationState {
  return !confirmation && !attempted ? "neutral" : confirmationError(password, confirmation) ? "invalid" : "valid";
}

export function isValidPassword(password: string): boolean {
  return passwordError(password) === null;
}

export function isValidLoginForm(email: string, password: string): boolean {
  return isValidEmail(email) && password.length > 0;
}

export function isValidResetCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export function isValidResetForm(code: string, password: string, passwordConfirmation: string): boolean {
  return isValidResetCode(code) && isValidPassword(password) && password === passwordConfirmation;
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
    const businessLength = Array.from((fields.businessName ?? "").trim()).length;
    const licenseLength = Array.from((fields.licenseNumber ?? "").trim()).length;
    if (verification.businessLabel && (businessLength === 0 || businessLength > 255)) return false;
    if (licenseLength < 4 || licenseLength > 100) return false;
  }

  return (
    fields.name.trim().length > 0 &&
    Array.from(fields.name.trim()).length <= 255 &&
    isValidEmail(fields.email) &&
    Array.from(fields.email.trim()).length <= 255 &&
    isValidPassword(fields.password) &&
    fields.password === fields.passwordConfirmation
  );
}
