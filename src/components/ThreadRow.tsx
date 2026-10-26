import { Link } from "react-router";

import { assigneeName, relativeTime } from "../lib/format.ts";
import type { ThreadSummary } from "../plain/operations.ts";
import { Avatar } from "./Avatar.tsx";
import { LabelBadge, PriorityBadge } from "./Badge.tsx";
import styles from "./ThreadRow.module.css";

type ThreadRowProps = {
  thread: ThreadSummary;
  /** The queue's query string, so the thread page can link back to the same view. */
  queueSearch: string;
};

export function ThreadRow({ thread, queueSearch }: ThreadRowProps) {
  const assignee = assigneeName(thread.assignedTo);
  const assigneeAvatar = thread.assignedTo?.__typename === "User" ? thread.assignedTo.avatarUrl : null;

  return (
    <li>
      <Link to={`/threads/${thread.id}`} state={{ queueSearch }} className={styles.row}>
        <div className={styles.main}>
          <div className={styles.meta}>
            <span className={styles.customer}>{thread.customer.fullName}</span>
            <span className={styles.ref}>{thread.ref}</span>
          </div>
          <p className={styles.title}>{thread.title}</p>
          {thread.previewText && <p className={styles.preview}>{thread.previewText}</p>}
        </div>
        <div className={styles.side}>
          <div className={styles.badges}>
            {thread.priority < 2 && <PriorityBadge priority={thread.priority} />}
            {thread.labels.slice(0, 2).map((label) => (
              <LabelBadge key={label.id} name={label.labelType.name} color={label.labelType.color} />
            ))}
            {thread.labels.length > 2 && <span className={styles.more}>+{thread.labels.length - 2}</span>}
          </div>
          <div className={styles.details}>
            {assignee ? (
              <span title={`Assigned to ${assignee}`}>
                <Avatar name={assignee} src={assigneeAvatar} size="sm" />
              </span>
            ) : (
              <span className={styles.unassigned} title="Unassigned" />
            )}
            <time className={styles.time} dateTime={thread.statusChangedAt.iso8601}>
              {relativeTime(thread.statusChangedAt.iso8601)}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}
