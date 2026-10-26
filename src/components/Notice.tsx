import type { ReactNode } from "react";

import styles from "./Notice.module.css";

type NoticeProps = {
  tone?: "info" | "warning" | "error";
  title?: string;
  children?: ReactNode;
};

export function Notice({ tone = "info", title, children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {title && <p className={styles.title}>{title}</p>}
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
