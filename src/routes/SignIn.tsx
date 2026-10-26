import { useAuth } from "react-oidc-context";
import { Navigate, useLocation } from "react-router";

import { signIn } from "../auth.ts";
import { Button } from "../components/Button.tsx";
import { CenteredCard, LoadingScreen } from "../components/CenteredCard.tsx";
import { Notice } from "../components/Notice.tsx";
import styles from "./SignIn.module.css";

export type SignInLocationState = {
  returnTo?: string;
  sessionExpired?: boolean;
};

export function SignIn() {
  const auth = useAuth();
  const location = useLocation();
  const state = (location.state ?? {}) as SignInLocationState;

  if (auth.isLoading) {
    return <LoadingScreen label="Loading…" />;
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/threads" replace />;
  }

  return (
    <CenteredCard>
      <div className={styles.logo} aria-hidden>
        <svg viewBox="0 0 32 32" width="40" height="40">
          <rect width="32" height="32" rx="8" fill="currentColor" />
          <path
            d="M9 11.5A2.5 2.5 0 0 1 11.5 9h9a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H15l-4 3.5V20h0.5A2.5 2.5 0 0 1 9 17.5z"
            fill="#fff"
          />
        </svg>
      </div>
      <div className={styles.heading}>
        <h1>Support inbox</h1>
        <p>
          An example app that signs you in with your Plain account and works through your workspace's threads with
          Plain's GraphQL API.
        </p>
      </div>

      {state.sessionExpired && (
        <Notice tone="warning" title="Your session expired">
          Sign in again to continue.
        </Notice>
      )}
      {auth.error && !state.sessionExpired && (
        <Notice tone="error" title="Sign-in failed">
          {auth.error.message}
        </Notice>
      )}

      <Button variant="primary" onClick={() => void signIn(auth, state.returnTo)}>
        Sign in with Plain
      </Button>
      <p className={styles.footnote}>
        You'll be sent to Plain to sign in. Everything you do here runs as you, with the permissions your role in Plain
        already has.
      </p>
    </CenteredCard>
  );
}
