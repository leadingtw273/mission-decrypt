import type { ChangeEventHandler, InputHTMLAttributes } from 'react';

type InputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  'aria-label': string;
  id: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'name' | 'type' | 'autoComplete'>;

export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  type = 'text',
  ...rest
}: InputProps) {
  return (
    <div className="group relative flex items-center border border-border bg-bg-secondary/70">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-0.5 bg-border transition-colors group-focus-within:bg-primary"
      />
      <input
        {...rest}
        className="font-body w-full border-0 bg-transparent px-4 py-3 pl-5 text-text outline-none placeholder:text-text/55 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id={id}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </div>
  );
}
