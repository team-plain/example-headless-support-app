import { Link } from "react-router";

import { STATUS_LABELS } from "../lib/format.ts";
import type { ThreadStatus } from "../plain/operations.ts";
import styles from "./StatusTabs.module.css";

type StatusTabsProps = {
  current: ThreadStatus;
  /** Shown next to the current tab once it has loaded. */
  count: number | undefined;
  hrefFor: (status: ThreadStatus) => string;
};

const STATUSES: ThreadStatus[] = ["TODO", "SNOOZED", "DONE"];

export function StatusTabs({ current, count, hrefFor }: StatusTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Thread status">
      {STATUSES.map((status) => {
        const active = status === current;
        return (
          <Link
            key={status}
            to={hrefFor(status)}
            className={active ? `${styles.tab} ${styles.active}` : styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {STATUS_LABELS[status]}
            {active && count !== undefined && <span className={styles.count}>{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
