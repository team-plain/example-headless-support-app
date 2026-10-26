import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export function buttonClassName(variant: Variant = "secondary", size: Size = "md") {
  return `${styles.button} ${styles[variant]} ${styles[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  const classes = className ? `${buttonClassName(variant, size)} ${className}` : buttonClassName(variant, size);
  return <button type={type} className={classes} {...props} />;
}
