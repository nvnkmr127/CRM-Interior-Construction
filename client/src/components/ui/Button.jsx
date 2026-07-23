import styles from './Button.module.css';

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  onClick,
  type = 'button',
  children,
  className: customClassName,
  ...props
}) {
  const className = [
    styles.btn,
    styles[variant],
    styles[size],
    customClassName
  ].filter(Boolean).join(' ');

  const isBtnLoading = loading || isLoading;

  return (
    <button
      className={className}
      onClick={onClick}
      type={type}
      disabled={disabled || isBtnLoading}
      {...props}
    >
      {isBtnLoading && <span className={styles.spinner} />}
      {!isBtnLoading && leftIcon}
      {children}
      {!isBtnLoading && rightIcon}
    </button>
  );
}
