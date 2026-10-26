import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { Navigate, Outlet, useLocation } from "react-router";

import { LoadingScreen } from "../components/CenteredCard.tsx";
import type { SignInLocationState } from "./SignIn.tsx";

/** Renders the signed-in part of the app, or sends the user to sign in. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  const [renewFailed, setRenewFailed] = useState(false);
  const renewStarted = useRef(false);

  // automaticSilentRenew only refreshes tokens that haven't expired yet. If the
  // tab was asleep past expiry, refresh once here before giving up.
  const canRenew = !auth.isAuthenticated && !!auth.user?.expired && !!auth.user.refresh_token;

  useEffect(() => {
    if (!canRenew || renewStarted.current) return;
    renewStarted.current = true;
    auth.signinSilent().catch(async () => {
      await auth.removeUser();
      setRenewFailed(true);
    });
  }, [auth, canRenew]);

  if (auth.isLoading || (canRenew && !renewFailed)) {
    return <LoadingScreen label="Loading…" />;
  }

  if (!auth.isAuthenticated) {
    const state: SignInLocationState = {
      returnTo: location.pathname + location.search,
      sessionExpired: renewFailed,
    };
    return <Navigate to="/" replace state={state} />;
  }

  return <Outlet />;
}
