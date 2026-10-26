import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router";

import { returnToAfterSignIn } from "../auth.ts";
import { LoadingScreen } from "../components/CenteredCard.tsx";

/**
 * Plain redirects here after sign-in. AuthProvider has already spotted the
 * `code` and `state` in the URL and is exchanging the code for tokens; this
 * page waits for that to finish.
 */
export function Callback() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <LoadingScreen label="Signing you in…" />;
  }

  if (auth.isAuthenticated) {
    return <Navigate to={returnToAfterSignIn(auth.user)} replace />;
  }

  // Sign-in failed or was cancelled. The sign-in page shows `auth.error`.
  return <Navigate to="/" replace />;
}
