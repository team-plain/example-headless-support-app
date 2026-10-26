import { WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthContextProps, AuthProviderProps } from "react-oidc-context";

import {
  clearSignInRecovery,
  readSignInRecovery,
  wipeOidcStorage,
  writeSignInRecovery,
  type SignInRecovery,
} from "./authSession.ts";

/**
 * Everything this app needs to sign in with Plain.
 *
 * This is a browser-only app, which makes it an OAuth *public client*: it has a
 * client ID but no client secret, because anything shipped to the browser can
 * be read by anyone. Instead of a secret, oidc-client-ts uses PKCE (on by
 * default) to prove that the app exchanging the code is the one that asked
 * for it.
 */

export const clientId = import.meta.env.VITE_PLAIN_OAUTH_CLIENT_ID?.trim() ?? "";

const authority = import.meta.env.VITE_PLAIN_AUTH_URL?.trim() || "https://signin.auth.plain.com";

export const oidcConfig: AuthProviderProps = {
  // Endpoints are read from {authority}/.well-known/openid-configuration.
  authority,
  client_id: clientId,
  // Must exactly match one of the redirect URLs on your Plain OAuth app.
  redirect_uri: `${window.location.origin}/callback`,
  // `offline_access` asks for a refresh token, so the session outlives the
  // short-lived access token.
  scope: "openid offline_access",
  // Refreshes the access token with the refresh token shortly before it expires.
  automaticSilentRenew: true,
  // sessionStorage is per tab and is cleared when the tab closes. The user and
  // the in-flight PKCE state both live here. See the README for the trade-offs
  // of keeping tokens in the browser.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  // Remove ?code=...&state=... from the address bar once they have been used.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

type SignInState = { returnTo: string };

/** Sends the browser to Plain's sign-in page. */
export function signIn(auth: AuthContextProps, returnTo = "/threads") {
  const state: SignInState = { returnTo };
  // A skipped workspace, or a sign-in that bounced back here, leaves a Plain
  // session that the next visit silently reuses. `prompt=login` starts a new
  // one so the workspace step is shown again. There is no end-session endpoint.
  const forceFreshLogin = currentSignInRecovery() != null;
  return auth.signinRedirect({
    // Plain requires a nonce. oidc-client-ts stores it and rejects an ID token
    // whose nonce doesn't match.
    nonce: crypto.randomUUID(),
    state,
    ...(forceFreshLogin ? { prompt: "login", max_age: 0 } : {}),
  });
}

function storageIfAvailable(kind: "local" | "session"): Storage | null {
  try {
    const storage = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "plain.storageProbe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Where a broken sign-in is remembered. localStorage survives closing the tab. */
function recoveryStorage(): Storage | null {
  return storageIfAvailable("local") ?? storageIfAvailable("session");
}

export function currentSignInRecovery(): SignInRecovery | null {
  const storage = recoveryStorage();
  return storage ? readSignInRecovery(storage) : null;
}

export function rememberSignInRecovery(reason: SignInRecovery): void {
  const storage = recoveryStorage();
  if (storage) writeSignInRecovery(storage, reason);
}

export function forgetSignInRecovery(): void {
  const local = storageIfAvailable("local");
  const session = storageIfAvailable("session");
  if (local) clearSignInRecovery(local);
  if (session) clearSignInRecovery(session);
}

/**
 * Drop every local trace of the Plain session: the user, in-flight PKCE state,
 * and any oidc keys left in either storage. `clearStaleState` only removes
 * entries older than 15 minutes, which is too slow to break a login loop.
 */
export async function clearLocalSignIn(auth: AuthContextProps): Promise<void> {
  try {
    auth.stopSilentRenew();
  } catch {
    // Silent renew was never started.
  }
  try {
    await auth.removeUser();
  } catch {
    // The user was already gone.
  }
  try {
    await auth.clearStaleState();
  } catch {
    // Best-effort. The wipe below removes fresh state too.
  }
  const session = storageIfAvailable("session");
  const local = storageIfAvailable("local");
  if (session) wipeOidcStorage(session);
  if (local) wipeOidcStorage(local);
}

/** Sign out for good and make the next "Sign in" start a new Plain session. */
export async function recoverFromBrokenSignIn(auth: AuthContextProps, reason: SignInRecovery): Promise<void> {
  rememberSignInRecovery(reason);
  await clearLocalSignIn(auth);
}

/** Where to go after signing in: the page the user was on when we sent them to Plain. */
export function returnToAfterSignIn(user: User | null | undefined): string {
  const state = user?.state as Partial<SignInState> | undefined;
  const returnTo = state?.returnTo;
  // Only same-site paths. "//example.com" starts with "/" but leaves the site.
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/threads";
}
