import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "./password-policy";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hashed: string | null | undefined
): Promise<boolean> {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}

export function isValidPasswordLength(plain: string): boolean {
  return plain.length >= MIN_PASSWORD_LENGTH;
}
