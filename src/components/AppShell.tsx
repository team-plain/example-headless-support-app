import { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { Link, Outlet, useNavigate } from "react-router";

import { clearLocalSignIn, forgetSignInRecovery, recoverFromBrokenSignIn } from "../auth.ts";
import { usePlainQuery } from "../plain/hooks.ts";
import { getViewer, type Viewer } from "../plain/operations.ts";
import { Avatar } from "./Avatar.tsx";
import { Button } from "./Button.tsx";
import { CenteredCard, LoadingScreen } from "./CenteredCard.tsx";
import { Notice } from "./Notice.tsx";
import styles from "./AppShell.module.css";

type SignedInViewer = {
  user: NonNullable<Viewer["myUser"]>;
  workspace: NonNullable<Viewer["myWorkspace"]>;
};

const ViewerContext = createContext<SignedInViewer | null>(null);

/** The signed-in Plain user and their workspace. */
export function useViewer(): SignedInViewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <AppShell>");
  return viewer;
}

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const viewer = usePlainQuery(getViewer, []);
  const signedOut = useRef(false);

  const user = viewer.data?.myUser;
  const workspace = viewer.data?.myWorkspace;
  // Plain does not require a workspace on the sign-in screen. Continuing
  // without one yields a token that can never load this app, and the next
  // login replays it. Sign out before that loop starts.
  const missingWorkspace = !viewer.isLoading && !viewer.error && !!viewer.data && (!user || !workspace);

  useEffect(() => {
    if (user && workspace) forgetSignInRecovery();
  }, [user, workspace]);

  useEffect(() => {
    if (!missingWorkspace || signedOut.current) return;
    signedOut.current = true;
    void recoverFromBrokenSignIn(auth, "workspace");
  }, [auth, missingWorkspace]);

  // There is no token revocation endpoint, so signing out forgets the tokens
  // in this browser. They stop working when they expire.
  async function signOut() {
    await clearLocalSignIn(auth);
    navigate("/", { replace: true });
  }

  if (viewer.isLoading || missingWorkspace) {
    return <LoadingScreen label={missingWorkspace ? "Signing you out…" : "Loading your workspace…"} />;
  }

  if (viewer.error || !user || !workspace) {
    return (
      <CenteredCard>
        <Notice tone="error" title="Couldn't load your Plain account">
          {viewer.error?.message ?? "This access token doesn't belong to a person in a Plain workspace."}
        </Notice>
        <Button onClick={viewer.reload}>Try again</Button>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </CenteredCard>
    );
  }

  return (
    <ViewerContext.Provider value={{ user, workspace }}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <Link to="/threads" className={styles.brand}>
              <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
                <rect width="32" height="32" rx="8" fill="currentColor" />
                <path
                  d="M9 11.5A2.5 2.5 0 0 1 11.5 9h9a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H15l-4 3.5V20h0.5A2.5 2.5 0 0 1 9 17.5z"
                  fill="#fff"
                />
              </svg>
              Support inbox
            </Link>
            <span className={styles.workspace}>{workspace.publicName || workspace.name}</span>
            <div className={styles.account}>
              <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              <span className={styles.userName}>{user.fullName}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </ViewerContext.Provider>
  );
}
