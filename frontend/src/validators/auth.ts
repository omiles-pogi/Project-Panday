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

export function isValidRegisterForm(fields: {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}): boolean {
  return (
    fields.name.trim().length > 0 &&
    isValidEmail(fields.email) &&
    isValidPassword(fields.password) &&
    fields.password === fields.passwordConfirmation
  );
}
