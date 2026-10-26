import { PRIORITY_LABELS } from "../lib/format.ts";
import styles from "./FilterBar.module.css";

export type AssigneeFilter = "any" | "me" | "unassigned";

type FilterBarProps = {
  assignee: AssigneeFilter;
  priority: number | null;
  onChange: (changes: { assignee?: AssigneeFilter; priority?: number | null }) => void;
};

export function FilterBar({ assignee, priority, onChange }: FilterBarProps) {
  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span>Assignee</span>
        <select value={assignee} onChange={(event) => onChange({ assignee: event.target.value as AssigneeFilter })}>
          <option value="any">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Priority</span>
        <select
          value={priority ?? ""}
          onChange={(event) => onChange({ priority: event.target.value === "" ? null : Number(event.target.value) })}
        >
          <option value="">Any</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
