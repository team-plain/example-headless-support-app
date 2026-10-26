import { CenteredCard } from "../components/CenteredCard.tsx";
import { Notice } from "../components/Notice.tsx";
import styles from "./SignIn.module.css";

/** Shown when the app was built without a Plain OAuth client ID. */
export function SetupRequired() {
  return (
    <CenteredCard>
      <div className={styles.heading}>
        <h1>Almost there</h1>
        <p>This app needs the client ID of a Plain OAuth app before you can sign in.</p>
      </div>
      <Notice tone="warning" title="VITE_PLAIN_OAUTH_CLIENT_ID is not set">
        Copy <code>.env.example</code> to <code>.env.local</code>, add your client ID, and restart the dev server.
      </Notice>
      <code className={styles.code}>
        {`cp .env.example .env.local\n# set VITE_PLAIN_OAUTH_CLIENT_ID\nnpm run dev`}
      </code>
      <p className={styles.footnote}>
        Create the OAuth app in Plain under Settings → OAuth applications, with the redirect URL{" "}
        <code>{window.location.origin}/callback</code>.
      </p>
    </CenteredCard>
  );
}
