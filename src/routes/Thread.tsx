import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { useViewer } from "../components/AppShell.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { Badge, LabelBadge, PriorityBadge, StatusBadge } from "../components/Badge.tsx";
import { Button, buttonClassName } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { ReplyForm } from "../components/ReplyForm.tsx";
import { Timeline } from "../components/Timeline.tsx";
import { isMessageFrom, type PendingReply } from "../components/TimelineEntry.tsx";
import { CHANNEL_LABELS, assigneeName, plainThreadUrl } from "../lib/format.ts";
import { usePlainMutation, usePlainQuery } from "../plain/hooks.ts";
import {
  REPLYABLE_CHANNELS,
  getThread,
  markThreadAsDone,
  markThreadAsTodo,
  replyToThread,
  type MutationError,
  type ThreadDetail,
  type TimelineEntry,
} from "../plain/operations.ts";
import type { QueueLocationState } from "./Queue.tsx";
import styles from "./Thread.module.css";

/** Plain adds a reply to the timeline shortly after replyToThread returns, so poll until it shows up. */
const REPLY_POLL_INTERVAL_MS = 1500;
const REPLY_POLL_TIMEOUT_MS = 30_000;

export function Thread() {
  const { threadId = "" } = useParams();
  // A fresh component per thread, so nothing from the previous thread lingers.
  return <ThreadPage key={threadId} threadId={threadId} />;
}

function useQueueHref() {
  const location = useLocation();
  const queueSearch = (location.state as { queueSearch?: string } | null)?.queueSearch ?? "";
  return `/threads${queueSearch}`;
}

function ThreadPage({ threadId }: { threadId: string }) {
  const queueHref = useQueueHref();
  const thread = usePlainQuery((accessToken) => getThread(accessToken, threadId), [threadId]);

  if (thread.isLoading) {
    return <p className={styles.loading}>Loading thread…</p>;
  }

  if (thread.error || !thread.data) {
    return (
      <div className={styles.page}>
        <title>Thread · Support inbox</title>
        <Link to={queueHref} className={styles.back}>
          ← Threads
        </Link>
        <Notice tone="error" title={thread.error ? "Couldn't load this thread" : "Thread not found"}>
          {thread.error?.message ?? "It may have been deleted, or you may not have access to it."}
        </Notice>
      </div>
    );
  }

  return <ThreadView data={thread.data} reload={thread.reload} />;
}

type ActionError = { title: string; message: string; code?: string };

function fromMutationError(title: string, error: MutationError): ActionError {
  const fieldMessages = error.fields.map((field) => `${field.field}: ${field.message}`);
  return { title, message: [error.message, ...fieldMessages].join(" "), code: error.code };
}

function fromThrown(title: string, error: unknown): ActionError {
  return { title, message: error instanceof Error ? error.message : String(error) };
}

type TimelinePageInfo = ThreadDetail["timelineEntries"]["pageInfo"];

/** Older pages of the timeline, loaded with "Show earlier activity". */
type EarlierPages = {
  /** The newest page's end cursor these pages continue from. */
  continuesFrom: string;
  /** Newest first, like Plain returns them. */
  entries: TimelineEntry[];
  pageInfo: TimelinePageInfo;
};

type SentReply = PendingReply & {
  /** Timeline entries that existed when the reply was sent, to spot the reply when it arrives. */
  knownEntryIds: Set<string>;
};

function ThreadView({ data, reload }: { data: ThreadDetail; reload: () => void }) {
  const { user, workspace } = useViewer();
  const navigate = useNavigate();
  const queueHref = useQueueHref();
  const mutation = usePlainMutation();
  const earlierLoader = usePlainMutation();
  const [earlier, setEarlier] = useState<EarlierPages | null>(null);
  const [replies, setReplies] = useState<SentReply[]>([]);
  const [actionError, setActionError] = useState<ActionError | null>(null);

  const newestPage = data.timelineEntries;
  // When new activity arrives, the newest page shifts and no longer lines up
  // with the earlier pages, so drop them rather than show a gap.
  const earlierPages = earlier?.continuesFrom === newestPage.pageInfo.endCursor ? earlier : null;
  const pageInfo = earlierPages?.pageInfo ?? newestPage.pageInfo;
  const newestFirst = [...newestPage.edges.map((edge) => edge.node), ...(earlierPages?.entries ?? [])];

  // Replies reach the timeline in the order they were sent, so each of the
  // user's messages that is new since the first reply confirms one reply.
  const arrivedCount = replies.length
    ? newestFirst.filter((entry) => isMessageFrom(entry, user.id) && !replies[0].knownEntryIds.has(entry.id)).length
    : 0;
  const pendingReplies = replies.slice(arrivedCount);
  const isWaitingForTimeline = pendingReplies.some((reply) => reply.status === "sent");

  useEffect(() => {
    if (!isWaitingForTimeline) return;
    const interval = setInterval(reload, REPLY_POLL_INTERVAL_MS);
    const timeout = setTimeout(() => clearInterval(interval), REPLY_POLL_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isWaitingForTimeline, reload]);

  const plainUrl = plainThreadUrl(workspace.id, data.id);
  const assignee = assigneeName(data.assignedTo);
  const channelLabel = CHANNEL_LABELS[data.channel] ?? data.channel;
  const canReply = REPLYABLE_CHANNELS.includes(data.channel);

  async function loadEarlier() {
    const after = pageInfo.endCursor;
    if (!after) return;
    try {
      const page = await earlierLoader.run((accessToken) => getThread(accessToken, data.id, after));
      if (!page) return;
      setEarlier({
        continuesFrom: newestPage.pageInfo.endCursor ?? "",
        entries: [...(earlierPages?.entries ?? []), ...page.timelineEntries.edges.map((edge) => edge.node)],
        pageInfo: page.timelineEntries.pageInfo,
      });
    } catch (error) {
      setActionError(fromThrown("Couldn't load earlier activity", error));
    }
  }

  /** Runs one mutation and shows its error under the reply box. Resolves to true if it succeeded. */
  async function runAction(
    failureTitle: string,
    mutate: (accessToken: string) => Promise<MutationError | null>,
  ): Promise<boolean> {
    setActionError(null);
    try {
      const error = await mutation.run(mutate);
      if (error === undefined) return false;
      if (error) {
        setActionError(fromMutationError(failureTitle, error));
        return false;
      }
      return true;
    } catch (error) {
      setActionError(fromThrown(failureTitle, error));
      return false;
    }
  }

  function backToQueueAfterDone() {
    const state: QueueLocationState = { markedDone: { id: data.id, ref: data.ref } };
    navigate(queueHref, { state });
  }

  async function send(text: string, { markAsDone }: { markAsDone: boolean }): Promise<boolean> {
    const key = crypto.randomUUID();
    const knownEntryIds = new Set(newestFirst.map((entry) => entry.id));
    const reply: SentReply = { key, text, status: "sending", knownEntryIds };
    // Once every earlier reply has arrived, start counting afresh from this one.
    setReplies((current) => (pendingReplies.length ? [...current, reply] : [reply]));

    const sent = await runAction("Your reply wasn't sent", (accessToken) => replyToThread(accessToken, data.id, text));
    if (!sent) {
      setReplies((current) => current.filter((reply) => reply.key !== key));
      return false;
    }
    setReplies((current) => current.map((reply) => (reply.key === key ? { ...reply, status: "sent" } : reply)));

    if (markAsDone) {
      const done = await runAction("Reply sent, but the thread wasn't marked as done", (accessToken) =>
        markThreadAsDone(accessToken, data.id),
      );
      if (done) {
        backToQueueAfterDone();
        return true;
      }
    }

    reload();
    return true;
  }

  async function markDone() {
    const done = await runAction("The thread wasn't marked as done", (accessToken) =>
      markThreadAsDone(accessToken, data.id),
    );
    if (done) backToQueueAfterDone();
  }

  async function markTodo() {
    const moved = await runAction("The thread wasn't moved back to Todo", (accessToken) =>
      markThreadAsTodo(accessToken, data.id),
    );
    if (moved) reload();
  }

  return (
    <div className={styles.page}>
      <title>{`${data.title} · Support inbox`}</title>
      <Link to={queueHref} className={styles.back}>
        ← Threads
      </Link>

      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <span className={styles.ref}>{data.ref}</span>
            <h1>{data.title}</h1>
          </div>
          <div className={styles.actions}>
            <a className={buttonClassName("ghost", "sm")} href={plainUrl} target="_blank" rel="noreferrer">
              Open in Plain ↗
            </a>
            {data.status === "DONE" ? (
              <Button size="sm" onClick={markTodo} disabled={mutation.isPending}>
                Move back to Todo
              </Button>
            ) : (
              <Button size="sm" onClick={markDone} disabled={mutation.isPending}>
                Mark as done
              </Button>
            )}
          </div>
        </div>

        <dl className={styles.properties}>
          <div>
            <dt>Customer</dt>
            <dd className={styles.person}>
              <Avatar name={data.customer.fullName} size="sm" tone="customer" />
              <span>
                {data.customer.fullName} <span className={styles.subtle}>{data.customer.email.email}</span>
              </span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={data.status} />
            </dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={data.priority} />
            </dd>
          </div>
          <div>
            <dt>Assignee</dt>
            <dd>{assignee ?? <span className={styles.subtle}>Unassigned</span>}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>
              <Badge>{channelLabel}</Badge>
            </dd>
          </div>
          {data.labels.length > 0 && (
            <div>
              <dt>Labels</dt>
              <dd className={styles.labels}>
                {data.labels.map((label) => (
                  <LabelBadge key={label.id} name={label.labelType.name} color={label.labelType.color} />
                ))}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <Timeline
        entries={newestFirst.toReversed()}
        pendingReplies={pendingReplies}
        author={user}
        threadTitle={data.title}
        hasEarlier={pageInfo.hasNextPage}
        isLoadingEarlier={earlierLoader.isPending}
        onLoadEarlier={loadEarlier}
        plainUrl={plainUrl}
      />

      <div className={styles.composer}>
        {actionError && (
          <Notice tone="error" title={actionError.title}>
            {actionError.message} {actionError.code && <code>({actionError.code})</code>}
          </Notice>
        )}
        {canReply ? (
          <ReplyForm
            customerName={data.customer.fullName}
            isPending={mutation.isPending}
            onSend={send}
            onDraftChange={() => setActionError(null)}
          />
        ) : (
          <p className={styles.cannotReply}>
            The API can't reply to {channelLabel} threads.{" "}
            <a href={plainUrl} target="_blank" rel="noreferrer">
              Reply in Plain ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
