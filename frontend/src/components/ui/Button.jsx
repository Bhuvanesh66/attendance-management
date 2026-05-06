export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  icon,
  fullWidth = false,
  className = "",
  ...rest
}) {
  const cls = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    fullWidth ? "ui-btn--full" : "",
    loading ? "ui-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? <span className="ui-btn__spinner" aria-hidden /> : icon}
      <span>{children}</span>
    </button>
  );
}
