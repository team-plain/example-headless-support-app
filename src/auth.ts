import { WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthContextProps, AuthProviderProps } from "react-oidc-context";

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
  // sessionStorage is per tab and is cleared when the tab closes. See the README
  // for the trade-offs of keeping tokens in the browser.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  // Remove ?code=...&state=... from the address bar once they have been used.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

type SignInState = { returnTo: string };

/** Sends the browser to Plain's sign-in page. */
export function signIn(auth: AuthContextProps, returnTo = "/threads") {
  const state: SignInState = { returnTo };
  return auth.signinRedirect({
    // Plain requires a nonce. oidc-client-ts stores it and rejects an ID token
    // whose nonce doesn't match.
    nonce: crypto.randomUUID(),
    state,
  });
}

/** Where to go after signing in: the page the user was on when we sent them to Plain. */
export function returnToAfterSignIn(user: User | null | undefined): string {
  const state = user?.state as Partial<SignInState> | undefined;
  const returnTo = state?.returnTo;
  // Only same-site paths. "//example.com" starts with "/" but leaves the site.
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/threads";
}
