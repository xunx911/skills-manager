"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldBaseProps = {
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  label: string;
};

type TextFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextAreaFieldProps = FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectFieldProps = FieldBaseProps & SelectHTMLAttributes<HTMLSelectElement>;
type CheckboxFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type FileFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement> & {
  directory?: string;
  webkitdirectory?: string;
};

export function TextField({ className, error, hint, label, ...props }: TextFieldProps) {
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    error,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <input
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete={props.autoComplete ?? "off"}
        id={controlId}
      />
      {hintNode}
      {errorNode}
    </label>
  );
}

export function TextAreaField({ className, error, hint, label, ...props }: TextAreaFieldProps) {
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    error,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <textarea
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete={props.autoComplete ?? "off"}
        id={controlId}
      />
      {hintNode}
      {errorNode}
    </label>
  );
}

export function SelectField({ children, className, error, hint, label, ...props }: SelectFieldProps) {
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    error,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <select {...props} aria-describedby={describedBy} aria-invalid={invalid} id={controlId}>
        {children}
      </select>
      {hintNode}
      {errorNode}
    </label>
  );
}

export function FileField({ className, error, hint, label, ...props }: FileFieldProps) {
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    error,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <input {...props} aria-describedby={describedBy} aria-invalid={invalid} id={controlId} />
      {hintNode}
      {errorNode}
    </label>
  );
}

export function CheckboxField({ className, error, hint, label, ...props }: CheckboxFieldProps) {
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    error,
    props["aria-invalid"],
  );
  return (
    <label className={["workbenchCheckboxField", className].filter(Boolean).join(" ")}>
      <input
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        id={controlId}
        type={props.type ?? "checkbox"}
      />
      <span>{label}</span>
      {hintNode}
      {errorNode}
    </label>
  );
}

function useFieldDescription(
  id: string | undefined,
  describedBy: string | undefined,
  hint: ReactNode,
  error: ReactNode,
  ariaInvalid: InputHTMLAttributes<HTMLInputElement>["aria-invalid"],
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const mergedDescription = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;
  return {
    controlId,
    describedBy: mergedDescription,
    errorNode: error ? <small className="workbenchFieldError" id={errorId}><span className="visuallyHidden">Error: </span>{error}</small> : null,
    hintNode: hint ? <small className="workbenchFieldHint" id={hintId}>{hint}</small> : null,
    invalid: ariaInvalid ?? (error ? true : undefined),
  };
}

function fieldClassName(className: string | undefined) {
  return ["workbenchField", className].filter(Boolean).join(" ");
}
