import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "./Button.tsx";
import styles from "./ReplyForm.module.css";

type ReplyFormProps = {
  customerName: string;
  isPending: boolean;
  /** Resolves to true when the reply was sent, so the draft can be cleared. */
  onSend: (text: string, options: { markAsDone: boolean }) => Promise<boolean>;
  /** Called whenever the draft changes, e.g. to clear an earlier error. */
  onDraftChange?: () => void;
};

export function ReplyForm({ customerName, isPending, onSend, onDraftChange }: ReplyFormProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !isPending && text.trim().length > 0;

  async function send(markAsDone: boolean) {
    if (!canSend) return;
    const sent = await onSend(text.trim(), { markAsDone });
    if (sent) setText("");
    // Clicking a button moved focus off the textarea; put it back for the next reply.
    textareaRef.current?.focus();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onDraftChange?.();
        }}
        onKeyDown={handleKeyDown}
        placeholder={`Reply to ${customerName}…`}
        readOnly={isPending}
        rows={2}
        aria-label="Reply"
      />
      <div className={styles.footer}>
        <span className={styles.hint}>⌘/Ctrl + Enter to send</span>
        <div className={styles.buttons}>
          <Button disabled={!canSend} onClick={() => void send(true)}>
            Send and mark as done
          </Button>
          <Button type="submit" variant="primary" disabled={!canSend}>
            {isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
