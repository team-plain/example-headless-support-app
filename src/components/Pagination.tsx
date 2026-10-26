import { Button } from "./Button.tsx";
import styles from "./Pagination.module.css";

type PaginationProps = {
  summary: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function Pagination({ summary, hasPrevious, hasNext, onPrevious, onNext }: PaginationProps) {
  return (
    <div className={styles.pagination}>
      <span className={styles.summary}>{summary}</span>
      {(hasPrevious || hasNext) && (
        <div className={styles.buttons}>
          <Button size="sm" disabled={!hasPrevious} onClick={onPrevious}>
            Previous
          </Button>
          <Button size="sm" disabled={!hasNext} onClick={onNext}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
