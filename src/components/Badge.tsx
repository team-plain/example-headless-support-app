import type { ReactNode } from "react";

import { STATUS_LABELS, priorityLabel } from "../lib/format.ts";
import type { ThreadStatus } from "../plain/operations.ts";
import styles from "./Badge.module.css";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

const STATUS_TONES: Record<ThreadStatus, Tone> = {
  TODO: "accent",
  SNOOZED: "warning",
  DONE: "success",
};

export function StatusBadge({ status }: { status: ThreadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_TONES: Record<number, Tone> = {
  0: "danger",
  1: "warning",
  2: "neutral",
  3: "neutral",
};

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <Badge tone={PRIORITY_TONES[priority] ?? "neutral"}>
      <span className={styles.bars} data-priority={priority} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {priorityLabel(priority)}
    </Badge>
  );
}

export function LabelBadge({ name, color }: { name: string; color: string | null }) {
  return (
    <span className={styles.label}>
      <span className={styles.dot} style={{ background: color ?? "var(--color-text-subtle)" }} aria-hidden />
      {name}
    </span>
  );
}
