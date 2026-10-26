/**
 * Local bookkeeping for a sign-in that must not be reused.
 *
 * Plain lets someone continue without choosing a workspace. The resulting
 * session has no workspace, and the next visit to "Sign in" replays it and
 * lands back on this page. Remembering that here survives a reload; oidc
 * tokens themselves are wiped separately.
 */

export const OIDC_STORAGE_PREFIX = "oidc.";

export const SIGN_IN_RECOVERY_KEY = "plain.signInRecovery";

export type SignInRecovery = "workspace" | "bounced";

export function wipeOidcStorage(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(OIDC_STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function readSignInRecovery(storage: Storage): SignInRecovery | null {
  const value = storage.getItem(SIGN_IN_RECOVERY_KEY);
  return value === "workspace" || value === "bounced" ? value : null;
}

export function writeSignInRecovery(storage: Storage, reason: SignInRecovery): void {
  storage.setItem(SIGN_IN_RECOVERY_KEY, reason);
}

export function clearSignInRecovery(storage: Storage): void {
  storage.removeItem(SIGN_IN_RECOVERY_KEY);
}
