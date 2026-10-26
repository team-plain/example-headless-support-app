import { useEffect, useLayoutEffect, useRef } from "react";

import type { TimelineEntry as TimelineEntryData } from "../plain/operations.ts";
import { Button } from "./Button.tsx";
import { PendingReplyEntry, TimelineEntry, type PendingReply } from "./TimelineEntry.tsx";
import styles from "./Timeline.module.css";

const NEAR_BOTTOM_PX = 240;

function scrollToBottom(behavior: ScrollBehavior) {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

/**
 * Keeps the newest activity in view, like a chat: jumps to it when the thread
 * opens, and follows new activity if the reader is already near the bottom or
 * has just sent a reply. Loading earlier activity doesn't move the page.
 */
function useScrollToNewest(newestKey: string | undefined, isOwnReply: boolean) {
  const nearBottom = useRef(true);
  const shownKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    function update() {
      const distance = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      nearBottom.current = distance < NEAR_BOTTOM_PX;
    }
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useLayoutEffect(() => {
    if (!newestKey || newestKey === shownKey.current) return;
    const isFirst = shownKey.current === undefined;
    shownKey.current = newestKey;
    if (isFirst) scrollToBottom("instant");
    else if (isOwnReply || nearBottom.current) scrollToBottom("smooth");
  }, [newestKey, isOwnReply]);
}

type TimelineProps = {
  /** Oldest first. */
  entries: TimelineEntryData[];
  /** Replies sent from this page that aren't in `entries` yet. */
  pendingReplies: PendingReply[];
  author: { fullName: string; avatarUrl: string | null };
  threadTitle: string;
  hasEarlier: boolean;
  isLoadingEarlier: boolean;
  onLoadEarlier: () => void;
  plainUrl: string;
};

export function Timeline({
  entries,
  pendingReplies,
  author,
  threadTitle,
  hasEarlier,
  isLoadingEarlier,
  onLoadEarlier,
  plainUrl,
}: TimelineProps) {
  const newestPending = pendingReplies.at(-1);
  useScrollToNewest(newestPending?.key ?? entries.at(-1)?.id, !!newestPending);

  return (
    <section className={styles.timeline} aria-label="Thread timeline">
      {hasEarlier && (
        <div className={styles.earlier}>
          <Button size="sm" variant="ghost" onClick={onLoadEarlier} disabled={isLoadingEarlier}>
            {isLoadingEarlier ? "Loading…" : "Show earlier activity"}
          </Button>
        </div>
      )}
      {entries.length === 0 && pendingReplies.length === 0 ? (
        <p className={styles.empty}>Nothing has happened on this thread yet.</p>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry) => (
            <TimelineEntry key={entry.id} timelineEntry={entry} threadTitle={threadTitle} plainUrl={plainUrl} />
          ))}
          {pendingReplies.map((reply) => (
            <PendingReplyEntry key={reply.key} reply={reply} author={author} />
          ))}
        </ol>
      )}
    </section>
  );
}
