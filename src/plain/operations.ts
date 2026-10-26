/**
 * Every Plain API call this app makes.
 *
 * Each operation is a plain GraphQL string, plus TypeScript types that mirror
 * exactly what it selects. To try one in Plain's API explorer, paste it along
 * with the fragments it interpolates (`${...}`). For a
 * generated, fully typed client, see @team-plain/graphql.
 *
 * Schema: https://core-api.uk.plain.com/graphql/v1/schema.graphql
 */

import { plainRequest } from "./client.ts";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ThreadStatus = "TODO" | "SNOOZED" | "DONE";

export type ThreadChannel = "EMAIL" | "SLACK" | "CHAT" | "API" | "MS_TEAMS" | "DISCORD" | "IMPORT" | "INTERNAL";

type DateTime = { iso8601: string };

type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

/**
 * Mutations don't throw on failure. They return an `error` next to the result,
 * with a message that names any missing permission.
 * https://www.plain.com/docs/graphql/error-handling
 */
export type MutationError = {
  message: string;
  type: "VALIDATION" | "FORBIDDEN" | "INTERNAL";
  code: string;
  fields: Array<{ field: string; message: string; type: "VALIDATION" | "REQUIRED" | "NOT_FOUND" }>;
};

const MUTATION_ERROR_FIELDS = /* GraphQL */ `
  fragment MutationErrorFields on MutationError {
    message
    type
    code
    fields {
      field
      message
      type
    }
  }
`;

// ---------------------------------------------------------------------------
// Viewer: who is signed in, and to which workspace
// ---------------------------------------------------------------------------

export type Viewer = {
  /** The person who signed in. Only human users have one; machine users get null. */
  myUser: { id: string; fullName: string; email: string; avatarUrl: string | null } | null;
  myWorkspace: { id: string; name: string; publicName: string } | null;
};

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    myUser {
      id
      fullName
      email
      avatarUrl
    }
    myWorkspace {
      id
      name
      publicName
    }
  }
`;

export function getViewer(accessToken: string): Promise<Viewer> {
  return plainRequest<Viewer>(accessToken, VIEWER_QUERY);
}

// ---------------------------------------------------------------------------
// Threads: the queue
// https://www.plain.com/docs/graphql/threads/get
// ---------------------------------------------------------------------------

export type ThreadAssignee =
  | { __typename: "User"; id: string; fullName: string; avatarUrl: string | null }
  | { __typename: "MachineUser"; id: string; publicName: string }
  | { __typename: "System"; id: string };

const ASSIGNEE_FIELDS = /* GraphQL */ `
  fragment AssigneeFields on ThreadAssignee {
    __typename
    ... on User {
      id
      fullName
      avatarUrl
    }
    ... on MachineUser {
      id
      publicName
    }
    ... on System {
      id
    }
  }
`;

/** The fields selected by THREAD_FIELDS below. */
export type ThreadSummary = {
  id: string;
  /** Human-readable ID, e.g. T-1234. */
  ref: string;
  title: string;
  previewText: string | null;
  status: ThreadStatus;
  /** 0 = urgent, 1 = high, 2 = normal, 3 = low. */
  priority: number;
  channel: ThreadChannel;
  statusChangedAt: DateTime;
  customer: { id: string; fullName: string; email: { email: string } };
  assignedTo: ThreadAssignee | null;
  labels: Array<{ id: string; labelType: { id: string; name: string; color: string | null } }>;
};

const THREAD_FIELDS = /* GraphQL */ `
  fragment ThreadFields on Thread {
    id
    ref
    title
    previewText
    status
    priority
    channel
    statusChangedAt {
      iso8601
    }
    customer {
      id
      fullName
      email {
        email
      }
    }
    assignedTo {
      ...AssigneeFields
    }
    labels {
      id
      labelType {
        id
        name
        color
      }
    }
  }
  ${ASSIGNEE_FIELDS}
`;

/** The subset of Plain's ThreadsFilter input that this app uses. */
export type ThreadsFilter = {
  statuses?: ThreadStatus[];
  assignedToUser?: string[];
  isAssigned?: boolean;
  priorities?: number[];
};

/**
 * Relay-style cursor pagination: `first` + `after` to go forwards, `last` +
 * `before` to go backwards. Don't mix the two.
 * https://www.plain.com/docs/graphql/pagination
 */
export type PageArgs = { first: number; after?: string } | { last: number; before: string };

export type ThreadsConnection = {
  totalCount: number;
  pageInfo: PageInfo;
  edges: Array<{ cursor: string; node: ThreadSummary }>;
};

const THREADS_QUERY = /* GraphQL */ `
  query Threads(
    $filters: ThreadsFilter
    $sortBy: ThreadsSort
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    threads(filters: $filters, sortBy: $sortBy, first: $first, after: $after, last: $last, before: $before) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          ...ThreadFields
        }
      }
    }
  }
  ${THREAD_FIELDS}
`;

export async function getThreads(
  accessToken: string,
  filters: ThreadsFilter,
  page: PageArgs,
): Promise<ThreadsConnection> {
  const data = await plainRequest<{ threads: ThreadsConnection }>(accessToken, THREADS_QUERY, {
    filters,
    sortBy: { field: "STATUS_CHANGED_AT", direction: "DESC" },
    ...page,
  });
  return data.threads;
}

// ---------------------------------------------------------------------------
// Thread: one thread and its timeline
// ---------------------------------------------------------------------------

/** Who a timeline entry is attributed to. */
export type Actor =
  | { __typename: "UserActor"; user: { id: string; fullName: string; avatarUrl: string | null } }
  | { __typename: "CustomerActor"; customer: { id: string; fullName: string } }
  | { __typename: "MachineUserActor"; machineUser: { id: string; publicName: string } }
  | { __typename: "SystemActor" }
  | { __typename: "DeletedCustomerActor" };

/** Entries we render as messages. */
export type MessageEntry =
  | {
      __typename: "EmailEntry";
      subject: string | null;
      textContent: string | null;
      hasMoreTextContent: boolean;
      from: { name: string | null; email: string };
    }
  | { __typename: "ChatEntry"; chatText: string | null }
  | { __typename: "SlackMessageEntry" | "SlackReplyEntry" | "MSTeamsMessageEntry"; text: string }
  | { __typename: "DiscordMessageEntry"; markdownContent: string | null }
  | { __typename: "NoteEntry"; text: string }
  /** A message in an internal discussion about the thread, e.g. in a Slack channel. */
  | { __typename: "ThreadDiscussionMessageEntry"; text: string };

type EventLabel = { id: string; labelType: { name: string } };

/** Events we describe in words, e.g. "Alex Morgan marked the thread as done". */
export type DescribedEventEntry =
  | { __typename: "ThreadStatusTransitionedEntry"; nextStatus: ThreadStatus }
  | {
      __typename: "ThreadAssignmentTransitionedEntry";
      previousAssignee: ThreadAssignee | null;
      nextAssignee: ThreadAssignee | null;
    }
  | { __typename: "ThreadPriorityChangedEntry"; previousPriority: number; nextPriority: number }
  | { __typename: "ThreadLabelsChangedEntry"; previousLabels: EventLabel[]; nextLabels: EventLabel[] }
  | {
      __typename: "ThreadDiscussionEntry" | "ThreadDiscussionResolvedEntry";
      slackChannelName: string | null;
      emailRecipients: string[];
    }
  | { __typename: "ThreadEventEntry" | "CustomerEventEntry"; title: string };

/** Every other member of Plain's `Entry` union. These are shown using `llmText`. */
export type OtherEntry = {
  __typename:
    | "CustomEntry"
    | "LinearIssueThreadLinkStateTransitionedEntry"
    | "ThreadAdditionalAssigneesTransitionedEntry"
    | "ThreadServiceLevelAgreementPolicyChangedEntry"
    | "ServiceLevelAgreementStatusTransitionedEntry"
    | "ThreadLinkCreatedEntry"
    | "ThreadLinkUpdatedEntry"
    | "ThreadLinkDeletedEntry"
    | "ThreadLinkTargetCreatedEntry"
    | "ThreadLinkTargetDeletedEntry"
    | "HelpCenterAiConversationMessageEntry"
    | "CustomerSurveyRequestedEntry"
    | "MergedThreadMessageEntry";
};

export type TimelineEntry = {
  id: string;
  timestamp: DateTime;
  actor: Actor;
  entry: MessageEntry | DescribedEventEntry | OtherEntry;
  /** Plain's own plain-text rendering of the entry. Not always set, so only used as a fallback. */
  llmText: string | null;
};

export type ThreadDetail = ThreadSummary & {
  timelineEntries: {
    pageInfo: Pick<PageInfo, "hasNextPage" | "endCursor">;
    /** Newest first. */
    edges: Array<{ node: TimelineEntry }>;
  };
};

export const TIMELINE_PAGE_SIZE = 50;

// A thread's timeline comes back newest first, so `first` gets the most recent
// entries and `after` pages back through older ones.
//
// `text` is aliased on ChatEntry because it is nullable there but non-null on
// the Slack, Teams and note entries, and GraphQL rejects one field name with
// two different types in the same selection.
const THREAD_QUERY = /* GraphQL */ `
  query Thread($threadId: ID!, $first: Int!, $after: String) {
    thread(threadId: $threadId) {
      ...ThreadFields
      timelineEntries(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            timestamp {
              iso8601
            }
            llmText
            actor {
              __typename
              ... on UserActor {
                user {
                  id
                  fullName
                  avatarUrl
                }
              }
              ... on CustomerActor {
                customer {
                  id
                  fullName
                }
              }
              ... on MachineUserActor {
                machineUser {
                  id
                  publicName
                }
              }
            }
            entry {
              __typename
              ... on EmailEntry {
                subject
                textContent
                hasMoreTextContent
                from {
                  name
                  email
                }
              }
              ... on ChatEntry {
                chatText: text
              }
              ... on SlackMessageEntry {
                text
              }
              ... on SlackReplyEntry {
                text
              }
              ... on MSTeamsMessageEntry {
                text
              }
              ... on DiscordMessageEntry {
                markdownContent
              }
              ... on NoteEntry {
                text
              }
              ... on ThreadDiscussionMessageEntry {
                text
              }
              ... on ThreadStatusTransitionedEntry {
                nextStatus
              }
              ... on ThreadAssignmentTransitionedEntry {
                previousAssignee {
                  ...AssigneeFields
                }
                nextAssignee {
                  ...AssigneeFields
                }
              }
              ... on ThreadPriorityChangedEntry {
                previousPriority
                nextPriority
              }
              ... on ThreadLabelsChangedEntry {
                previousLabels {
                  id
                  labelType {
                    name
                  }
                }
                nextLabels {
                  id
                  labelType {
                    name
                  }
                }
              }
              ... on ThreadDiscussionEntry {
                slackChannelName
                emailRecipients
              }
              ... on ThreadDiscussionResolvedEntry {
                slackChannelName
                emailRecipients
              }
              ... on ThreadEventEntry {
                title
              }
              ... on CustomerEventEntry {
                title
              }
            }
          }
        }
      }
    }
  }
  ${THREAD_FIELDS}
`;

/** Returns null when the thread doesn't exist (or isn't visible to this user). */
export async function getThread(accessToken: string, threadId: string, after?: string): Promise<ThreadDetail | null> {
  const data = await plainRequest<{ thread: ThreadDetail | null }>(accessToken, THREAD_QUERY, {
    threadId,
    first: TIMELINE_PAGE_SIZE,
    after,
  });
  return data.thread;
}

// ---------------------------------------------------------------------------
// Reply to a thread
// https://www.plain.com/docs/graphql/messaging/reply-to-thread
// ---------------------------------------------------------------------------

/** Channels that `replyToThread` can send on. */
export const REPLYABLE_CHANNELS: ThreadChannel[] = ["EMAIL", "CHAT", "SLACK", "MS_TEAMS", "API"];

const REPLY_TO_THREAD_MUTATION = /* GraphQL */ `
  mutation ReplyToThread($input: ReplyToThreadInput!) {
    replyToThread(input: $input) {
      error {
        ...MutationErrorFields
      }
    }
  }
  ${MUTATION_ERROR_FIELDS}
`;

/**
 * Sends a reply on whichever channel the thread already uses. Because the
 * token belongs to the signed-in user, the reply is sent as them.
 */
export async function replyToThread(
  accessToken: string,
  threadId: string,
  textContent: string,
): Promise<MutationError | null> {
  const data = await plainRequest<{ replyToThread: { error: MutationError | null } }>(
    accessToken,
    REPLY_TO_THREAD_MUTATION,
    { input: { threadId, textContent } },
  );
  return data.replyToThread.error;
}

// ---------------------------------------------------------------------------
// Change a thread's status
// https://www.plain.com/docs/graphql/threads/status-changes
// ---------------------------------------------------------------------------

const MARK_THREAD_AS_DONE_MUTATION = /* GraphQL */ `
  mutation MarkThreadAsDone($input: MarkThreadAsDoneInput!) {
    markThreadAsDone(input: $input) {
      error {
        ...MutationErrorFields
      }
    }
  }
  ${MUTATION_ERROR_FIELDS}
`;

/** Done means "nothing left to do for now". Any new activity moves the thread back to Todo. */
export async function markThreadAsDone(accessToken: string, threadId: string): Promise<MutationError | null> {
  const data = await plainRequest<{ markThreadAsDone: { error: MutationError | null } }>(
    accessToken,
    MARK_THREAD_AS_DONE_MUTATION,
    { input: { threadId } },
  );
  return data.markThreadAsDone.error;
}

const MARK_THREAD_AS_TODO_MUTATION = /* GraphQL */ `
  mutation MarkThreadAsTodo($input: MarkThreadAsTodoInput!) {
    markThreadAsTodo(input: $input) {
      error {
        ...MutationErrorFields
      }
    }
  }
  ${MUTATION_ERROR_FIELDS}
`;

export async function markThreadAsTodo(accessToken: string, threadId: string): Promise<MutationError | null> {
  const data = await plainRequest<{ markThreadAsTodo: { error: MutationError | null } }>(
    accessToken,
    MARK_THREAD_AS_TODO_MUTATION,
    { input: { threadId } },
  );
  return data.markThreadAsTodo.error;
}
