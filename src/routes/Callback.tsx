import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { Navigate, useNavigate } from "react-router";

import { recoverFromBrokenSignIn, returnToAfterSignIn } from "../auth.ts";
import { LoadingScreen } from "../components/CenteredCard.tsx";

/**
 * Plain redirects here after sign-in. AuthProvider has already spotted the
 * `code` and `state` in the URL and is exchanging the code for tokens; this
 * page waits for that to finish.
 *
 * If that exchange fails, the person is about to land back on the sign-in
 * page. Sign them out and clear stored OIDC state first, or the next click
 * replays the same broken attempt.
 */
export function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (auth.isLoading || auth.isAuthenticated || started.current) return;
    started.current = true;
    if (!auth.error) {
      navigate("/", { replace: true });
      return;
    }
    void recoverFromBrokenSignIn(auth, "bounced").finally(() => {
      navigate("/", { replace: true });
    });
  }, [auth, auth.error, auth.isAuthenticated, auth.isLoading, navigate]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return <LoadingScreen label={auth.error ? "Signing you out…" : "Signing you in…"} />;
  }

  return <Navigate to={returnToAfterSignIn(auth.user)} replace />;
}
