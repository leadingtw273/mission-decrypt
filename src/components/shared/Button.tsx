import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = PropsWithChildren<{
  variant: 'primary' | 'secondary';
}> & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'disabled' | 'onClick' | 'type'>;

export function Button({
  variant,
  disabled = false,
  onClick,
  children,
  type = 'button',
  className,
  ...rest
}: ButtonProps & { className?: string }) {
  const variantClassName = variant === 'primary'
    ? 'bg-primary text-bg-primary hover:brightness-90'
    : 'border border-primary text-primary hover:bg-primary/10 hover:shadow-[0_0_16px_rgba(255,186,0,0.25)]';

  return (
    <button
      {...rest}
      className={joinClasses(
        'font-label inline-flex items-center justify-center px-4 py-2 text-sm uppercase transition disabled:cursor-not-allowed disabled:opacity-40',
        variantClassName,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}
