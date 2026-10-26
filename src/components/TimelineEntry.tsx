import { actorName, assigneeName, formatDateTime, priorityLabel, relativeTime } from "../lib/format.ts";
import type {
  DescribedEventEntry,
  MessageEntry,
  TimelineEntry as TimelineEntryData,
} from "../plain/operations.ts";
import { Avatar } from "./Avatar.tsx";
import styles from "./TimelineEntry.module.css";

const MESSAGE_CHANNELS: Record<MessageEntry["__typename"], string> = {
  EmailEntry: "Email",
  ChatEntry: "Chat",
  SlackMessageEntry: "Slack",
  SlackReplyEntry: "Slack",
  MSTeamsMessageEntry: "Microsoft Teams",
  DiscordMessageEntry: "Discord",
  NoteEntry: "Internal note",
  ThreadDiscussionMessageEntry: "Internal discussion",
};

function isMessage(entry: TimelineEntryData["entry"]): entry is MessageEntry {
  return Object.hasOwn(MESSAGE_CHANNELS, entry.__typename);
}

function messageText(entry: MessageEntry): string {
  switch (entry.__typename) {
    case "EmailEntry":
      return entry.textContent ?? "";
    case "ChatEntry":
      return entry.chatText ?? "";
    case "DiscordMessageEntry":
      return entry.markdownContent ?? "";
    case "SlackMessageEntry":
    case "SlackReplyEntry":
    case "MSTeamsMessageEntry":
    case "NoteEntry":
    case "ThreadDiscussionMessageEntry":
      return entry.text;
  }
}

/** Whether `timelineEntry` is a message written by the given Plain user. */
export function isMessageFrom(timelineEntry: TimelineEntryData, userId: string): boolean {
  return (
    isMessage(timelineEntry.entry) &&
    timelineEntry.actor.__typename === "UserActor" &&
    timelineEntry.actor.user.id === userId
  );
}

const STATUS_CHANGES = {
  TODO: "moved the thread to Todo",
  SNOOZED: "snoozed the thread",
  DONE: "marked the thread as done",
};

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

function labelChanges(previous: string[], next: string[]): string {
  const added = next.filter((name) => !previous.includes(name));
  const removed = previous.filter((name) => !next.includes(name));
  const parts = [];
  if (added.length) parts.push(`added ${added.length === 1 ? "the label" : "labels"} ${listFormat.format(added)}`);
  if (removed.length) parts.push(`removed ${removed.length === 1 ? "the label" : "labels"} ${listFormat.format(removed)}`);
  return parts.join(" and ") || "changed the labels";
}

function discussionPlace(entry: { slackChannelName: string | null; emailRecipients: string[] }): string {
  if (entry.slackChannelName) return ` in #${entry.slackChannelName}`;
  if (entry.emailRecipients.length) return " by email";
  return "";
}

/** What the actor did, phrased to follow their name. Null for event types we don't describe. */
function describeEvent(entry: TimelineEntryData["entry"]): string | null {
  const event = entry as DescribedEventEntry;
  switch (event.__typename) {
    case "ThreadStatusTransitionedEntry":
      return STATUS_CHANGES[event.nextStatus];
    case "ThreadAssignmentTransitionedEntry": {
      const next = assigneeName(event.nextAssignee);
      const previous = assigneeName(event.previousAssignee);
      if (next) return `assigned the thread to ${next}`;
      return previous ? `unassigned ${previous}` : "unassigned the thread";
    }
    case "ThreadPriorityChangedEntry":
      return `changed the priority from ${priorityLabel(event.previousPriority)} to ${priorityLabel(event.nextPriority)}`;
    case "ThreadLabelsChangedEntry":
      return labelChanges(
        event.previousLabels.map((label) => label.labelType.name),
        event.nextLabels.map((label) => label.labelType.name),
      );
    case "ThreadDiscussionEntry":
      return `started a discussion${discussionPlace(event)}`;
    case "ThreadDiscussionResolvedEntry":
      return `resolved the discussion${discussionPlace(event)}`;
    default:
      return null;
  }
}

// "ThreadStatusTransitionedEntry" -> "Thread status transitioned"
function describeEntryType(typename: string): string {
  const words = typename.replace(/Entry$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0) + words.slice(1).toLowerCase();
}

// "Re: Fwd: Invoice" -> "invoice"
function normalizeSubject(subject: string): string {
  return subject.replace(/^((re|fwd?|aw|sv)\s*:\s*)+/i, "").trim().toLowerCase();
}

function Time({ iso8601 }: { iso8601: string }) {
  return (
    <time dateTime={iso8601} title={formatDateTime(iso8601)} className={styles.time}>
      {relativeTime(iso8601)}
    </time>
  );
}

type TimelineEntryProps = {
  timelineEntry: TimelineEntryData;
  /** Emails whose subject is just the thread title don't repeat it. */
  threadTitle: string;
  /** Link to the thread in Plain, for emails that are too long to show in full. */
  plainUrl: string;
};

export function TimelineEntry({ timelineEntry, threadTitle, plainUrl }: TimelineEntryProps) {
  const { entry, actor, timestamp } = timelineEntry;

  if (!isMessage(entry)) {
    const action = describeEvent(entry);
    const title = entry.__typename === "ThreadEventEntry" || entry.__typename === "CustomerEventEntry" ? entry.title : null;
    return (
      <li className={styles.event}>
        <span className={styles.eventDot} aria-hidden />
        <span className={styles.eventText}>
          {action ? (
            <>
              <span className={styles.eventActor}>{actorName(actor)}</span> {action}
            </>
          ) : (
            (title ?? timelineEntry.llmText ?? describeEntryType(entry.__typename))
          )}
        </span>
        <Time iso8601={timestamp.iso8601} />
      </li>
    );
  }

  const name = actorName(actor);
  const fromCustomer = actor.__typename === "CustomerActor";
  const isInternal = entry.__typename === "NoteEntry" || entry.__typename === "ThreadDiscussionMessageEntry";
  const avatarUrl = actor.__typename === "UserActor" ? actor.user.avatarUrl : null;
  const side = isInternal ? styles.note : fromCustomer ? styles.inbound : styles.outbound;
  const subject =
    entry.__typename === "EmailEntry" && entry.subject && normalizeSubject(entry.subject) !== normalizeSubject(threadTitle)
      ? entry.subject
      : null;

  return (
    <li className={`${styles.message} ${side}`}>
      <Avatar name={name} src={avatarUrl} tone={fromCustomer ? "customer" : "neutral"} />
      <div className={styles.bubble}>
        <div className={styles.header}>
          <span className={styles.author}>{name}</span>
          <span className={styles.channel}>{MESSAGE_CHANNELS[entry.__typename]}</span>
          <Time iso8601={timestamp.iso8601} />
        </div>
        {subject && <p className={styles.subject}>{subject}</p>}
        <p className={styles.body}>{messageText(entry) || <em className={styles.empty}>No text content</em>}</p>
        {entry.__typename === "EmailEntry" && entry.hasMoreTextContent && (
          <a className={styles.more} href={plainUrl} target="_blank" rel="noreferrer">
            Email truncated. View the full email in Plain
          </a>
        )}
      </div>
    </li>
  );
}

export type PendingReply = {
  key: string;
  text: string;
  /** "sent" once replyToThread succeeds, until the reply shows up in the timeline. */
  status: "sending" | "sent";
};

/** A reply that was just sent, shown straight away while Plain adds it to the timeline. */
export function PendingReplyEntry({ reply, author }: { reply: PendingReply; author: { fullName: string; avatarUrl: string | null } }) {
  return (
    <li className={`${styles.message} ${styles.outbound} ${styles.pending}`}>
      <Avatar name={author.fullName} src={author.avatarUrl} />
      <div className={styles.bubble}>
        <div className={styles.header}>
          <span className={styles.author}>{author.fullName}</span>
          <span className={styles.time}>{reply.status === "sending" ? "Sending…" : "Sent"}</span>
        </div>
        <p className={styles.body}>{reply.text}</p>
      </div>
    </li>
  );
}
