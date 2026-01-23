import { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "medium",
  isLoading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const classNames = [
    "button",
    `button--${variant}`,
    `button--${size}`,
    isLoading ? "button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classNames}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="button__spinner" aria-hidden="true" />
      ) : null}
      <span className={isLoading ? "button__text--hidden" : ""}>
        {children}
      </span>
    </button>
  );
}
