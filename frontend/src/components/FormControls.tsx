import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={`form-field${error ? " form-field--error" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}
