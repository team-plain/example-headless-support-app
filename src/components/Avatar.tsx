import { initials } from "../lib/format.ts";
import styles from "./Avatar.module.css";

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
  tone?: "neutral" | "customer";
};

export function Avatar({ name, src, size = "md", tone = "neutral" }: AvatarProps) {
  const className = `${styles.avatar} ${styles[size]} ${styles[tone]}`;
  if (src) {
    return <img className={className} src={src} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <span className={className} aria-hidden>
      {initials(name)}
    </span>
  );
}
