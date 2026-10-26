import type { Actor, ThreadAssignee, ThreadChannel, ThreadStatus } from "../plain/operations.ts";

export const STATUS_LABELS: Record<ThreadStatus, string> = {
  TODO: "Todo",
  SNOOZED: "Snoozed",
  DONE: "Done",
};

/** Plain priorities are numbers: 0 is the most urgent. */
export const PRIORITY_LABELS: Record<number, string> = {
  0: "Urgent",
  1: "High",
  2: "Normal",
  3: "Low",
};

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? `P${priority}`;
}

export const CHANNEL_LABELS: Record<ThreadChannel, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  CHAT: "Chat",
  API: "API",
  MS_TEAMS: "Microsoft Teams",
  DISCORD: "Discord",
  IMPORT: "Import",
  INTERNAL: "Internal",
};

export function actorName(actor: Actor): string {
  switch (actor.__typename) {
    case "UserActor":
      return actor.user.fullName;
    case "CustomerActor":
      return actor.customer.fullName;
    case "MachineUserActor":
      return actor.machineUser.publicName;
    case "DeletedCustomerActor":
      return "Deleted customer";
    case "SystemActor":
      return "Plain";
  }
}

export function assigneeName(assignee: ThreadAssignee | null): string | null {
  if (!assignee) return null;
  switch (assignee.__typename) {
    case "User":
      return assignee.fullName;
    case "MachineUser":
      return assignee.publicName;
    case "System":
      return "Plain";
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "5 min. ago", "yesterday", "3 wk. ago"... */
export function relativeTime(iso8601: string, now = Date.now()): string {
  const seconds = (new Date(iso8601).getTime() - now) / 1000;
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeTimeFormat.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso8601: string): string {
  return dateTimeFormat.format(new Date(iso8601));
}

const PLAIN_APP_URL = (import.meta.env.VITE_PLAIN_APP_URL?.trim() || "https://app.plain.com").replace(/\/+$/, "");

/** Link to the same thread in Plain's own app. */
export function plainThreadUrl(workspaceId: string, threadId: string): string {
  return `${PLAIN_APP_URL}/workspace/${workspaceId}/thread/${threadId}/`;
}
