import type { ReactNode } from "react";

import styles from "./CenteredCard.module.css";

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>{children}</div>
    </main>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className={styles.page}>
      <p className={styles.loading}>
        <span className={styles.spinner} aria-hidden />
        {label}
      </p>
    </main>
  );
}
