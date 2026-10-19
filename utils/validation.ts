/**
 * Client-side input validation helpers — Fix 19
 * All functions return null on success, or an error string on failure.
 */

/** Validates a non-empty trimmed string */
export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || !value.trim()) return `${fieldName} is required.`;
  return null;
}

/** Validates email format */
export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) return 'Email is required.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

/**
 * Validates password strength:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

/** Validates that two password fields match */
export function validatePasswordMatch(password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

/** Validates a positive numeric amount */
export function validateAmount(value: string | number): string | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 0) return 'Please enter a valid amount greater than 0.';
  return null;
}

/** Validates a 6-digit OTP */
export function validateOtp(otp: string): string | null {
  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    return 'Please enter a valid 6-digit OTP.';
  }
  return null;
}

/**
 * Runs multiple validators and returns the first error found, or null.
 * Usage: const error = firstError(validateEmail(email), validatePassword(password));
 */
export function firstError(...results: (string | null)[]): string | null {
  return results.find((r) => r !== null) ?? null;
}
