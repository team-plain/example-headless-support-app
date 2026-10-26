import { useCallback, useEffect, useState, type DependencyList } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router";

import { clearLocalSignIn } from "../auth.ts";
import type { SignInLocationState } from "../routes/SignIn.tsx";
import { PlainAuthError } from "./client.ts";

/** Plain rejected the token: drop the local session and go back to sign-in. */
function useEndExpiredSession() {
  const auth = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    await clearLocalSignIn(auth);
    const state: SignInLocationState = { sessionExpired: true };
    navigate("/", { replace: true, state });
  }, [auth, navigate]);
}

type QueryResult<T> = { key: string; data?: T; error?: Error };

/**
 * Runs a Plain query with the signed-in user's access token, and runs it again
 * whenever `deps` change or `reload()` is called.
 */
export function usePlainQuery<T>(load: (accessToken: string) => Promise<T>, deps: DependencyList) {
  const auth = useAuth();
  const endExpiredSession = useEndExpiredSession();
  const key = JSON.stringify(deps);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const accessToken = auth.user?.access_token;

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    load(accessToken).then(
      (data) => {
        if (!cancelled) setResult({ key, data });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof PlainAuthError) {
          void endExpiredSession();
          return;
        }
        setResult({ key, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      cancelled = true;
    };
    // Re-run only when the inputs change, not every time the token is refreshed.
  }, [key, reloadCount]);

  // Results for previous inputs are discarded so a new thread never shows the old one's data.
  const current = result?.key === key ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    isLoading: !current,
    reload: useCallback(() => setReloadCount((count) => count + 1), []),
  };
}

/**
 * Runs Plain mutations with the signed-in user's access token and tracks
 * whether one is in flight.
 *
 * `run()` resolves to `undefined` if Plain rejected the token. By then the
 * user is already on their way back to the sign-in page.
 */
export function usePlainMutation() {
  const auth = useAuth();
  const endExpiredSession = useEndExpiredSession();
  const [isPending, setIsPending] = useState(false);

  async function run<T>(mutate: (accessToken: string) => Promise<T>): Promise<T | undefined> {
    const accessToken = auth.user?.access_token;
    if (!accessToken) {
      await endExpiredSession();
      return undefined;
    }
    setIsPending(true);
    try {
      return await mutate(accessToken);
    } catch (error) {
      if (error instanceof PlainAuthError) {
        await endExpiredSession();
        return undefined;
      }
      throw error;
    } finally {
      setIsPending(false);
    }
  }

  return { run, isPending };
}
