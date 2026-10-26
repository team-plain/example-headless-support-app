import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useViewer } from "../components/AppShell.tsx";
import { Button } from "../components/Button.tsx";
import { FilterBar, type AssigneeFilter } from "../components/FilterBar.tsx";
import { Notice } from "../components/Notice.tsx";
import { Pagination } from "../components/Pagination.tsx";
import { StatusTabs } from "../components/StatusTabs.tsx";
import { ThreadRow } from "../components/ThreadRow.tsx";
import { STATUS_LABELS } from "../lib/format.ts";
import { usePlainMutation, usePlainQuery } from "../plain/hooks.ts";
import {
  getThreads,
  markThreadAsTodo,
  type PageArgs,
  type ThreadsFilter,
  type ThreadStatus,
} from "../plain/operations.ts";
import styles from "./Queue.module.css";

const PAGE_SIZE = 25;

/** Set by the thread page after marking a thread as done, so the queue can confirm it and offer an undo. */
export type QueueLocationState = { markedDone?: { id: string; ref: string } };

const STATUSES: Record<string, ThreadStatus> = { todo: "TODO", snoozed: "SNOOZED", done: "DONE" };

/**
 * The queue's filters live in the URL (?status=todo&assignee=me&priority=0),
 * so every view can be bookmarked and survives a reload.
 */
function readFilters(params: URLSearchParams) {
  const status = STATUSES[params.get("status") ?? ""] ?? "TODO";
  const assigneeParam = params.get("assignee");
  const assignee: AssigneeFilter = assigneeParam === "me" || assigneeParam === "unassigned" ? assigneeParam : "any";
  const priorityParam = Number(params.get("priority") ?? NaN);
  const priority = Number.isInteger(priorityParam) && priorityParam >= 0 && priorityParam <= 3 ? priorityParam : null;
  return { status, assignee, priority };
}

export function Queue() {
  const { user } = useViewer();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { status, assignee, priority } = readFilters(params);

  // Translate the URL into Plain's ThreadsFilter input.
  const filters: ThreadsFilter = { statuses: [status] };
  if (assignee === "me") filters.assignedToUser = [user.id];
  if (assignee === "unassigned") filters.isAssigned = false;
  if (priority !== null) filters.priorities = [priority];

  const before = params.get("before");
  const after = params.get("after");
  const page: PageArgs = before ? { last: PAGE_SIZE, before } : { first: PAGE_SIZE, after: after ?? undefined };

  const threads = usePlainQuery((accessToken) => getThreads(accessToken, filters, page), [filters, page]);
  const undo = usePlainMutation();
  const navigate = useNavigate();
  const markedDone = (location.state as QueueLocationState | null)?.markedDone;
  const [undoError, setUndoError] = useState<string | null>(null);

  function dismissMarkedDone() {
    setUndoError(null);
    navigate({ search: location.search }, { replace: true, state: null });
  }

  async function undoMarkedDone() {
    if (!markedDone) return;
    try {
      const error = await undo.run((accessToken) => markThreadAsTodo(accessToken, markedDone.id));
      if (error === undefined) return;
      if (error) {
        setUndoError(error.message);
        return;
      }
      dismissMarkedDone();
      threads.reload();
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : String(error));
    }
  }

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  }

  // Changing a filter starts again from the first page.
  function changeFilters(changes: { assignee?: AssigneeFilter; priority?: number | null }) {
    updateParams({
      ...(changes.assignee !== undefined && { assignee: changes.assignee === "any" ? null : changes.assignee }),
      ...(changes.priority !== undefined && { priority: changes.priority === null ? null : String(changes.priority) }),
      after: null,
      before: null,
    });
  }

  function hrefForStatus(nextStatus: ThreadStatus) {
    const next = new URLSearchParams(params);
    next.set("status", nextStatus.toLowerCase());
    next.delete("after");
    next.delete("before");
    return `?${next}`;
  }

  const connection = threads.data;

  return (
    <div className={styles.page}>
      <title>{`${STATUS_LABELS[status]} · Support inbox`}</title>
      {markedDone && (
        <div className={styles.toast} role="status">
          <span>
            {undoError ? `Couldn't move ${markedDone.ref} back to Todo: ${undoError}` : `${markedDone.ref} marked as done.`}
          </span>
          <Button size="sm" variant="ghost" onClick={undoMarkedDone} disabled={undo.isPending}>
            {undo.isPending ? "Undoing…" : "Undo"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissMarkedDone} aria-label="Dismiss">
            ✕
          </Button>
        </div>
      )}
      <div className={styles.header}>
        <h1>Threads</h1>
        <div className={styles.controls}>
          <StatusTabs current={status} count={connection?.totalCount} hrefFor={hrefForStatus} />
          <FilterBar assignee={assignee} priority={priority} onChange={changeFilters} />
        </div>
      </div>

      <section className={styles.panel}>
        {threads.error ? (
          <div className={styles.message}>
            <Notice tone="error" title="Couldn't load threads">
              {threads.error.message}
            </Notice>
            <Button onClick={threads.reload}>Try again</Button>
          </div>
        ) : !connection ? (
          <ul className={styles.skeleton} aria-label="Loading threads">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} />
            ))}
          </ul>
        ) : connection.edges.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No {STATUS_LABELS[status].toLowerCase()} threads</p>
            <p>{status === "TODO" ? "Nothing left to do. Nice work." : "Try a different filter."}</p>
          </div>
        ) : (
          <>
            <ul className={styles.list}>
              {connection.edges.map(({ node }) => (
                <ThreadRow key={node.id} thread={node} queueSearch={location.search} />
              ))}
            </ul>
            <Pagination
              summary={`${connection.totalCount} ${connection.totalCount === 1 ? "thread" : "threads"}`}
              hasPrevious={connection.pageInfo.hasPreviousPage}
              hasNext={connection.pageInfo.hasNextPage}
              onPrevious={() => updateParams({ before: connection.pageInfo.startCursor, after: null })}
              onNext={() => updateParams({ after: connection.pageInfo.endCursor, before: null })}
            />
          </>
        )}
      </section>
    </div>
  );
}
