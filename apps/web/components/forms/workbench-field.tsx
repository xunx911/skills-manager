"use client";

import { useEffect, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { useFormFieldError } from "@/components/forms/form-validation";

type FieldBaseProps = {
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  label: string;
};

type TextFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextAreaFieldProps = FieldBaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    characterLimit?: number;
  };
type SelectFieldProps = FieldBaseProps & SelectHTMLAttributes<HTMLSelectElement>;
type CheckboxFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type FileFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement> & {
  directory?: string;
  webkitdirectory?: string;
};

export function TextField({ className, error, hint, label, ...props }: TextFieldProps) {
  const resolvedError = error ?? useFormFieldError(props.name);
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    resolvedError,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)} data-field-root="true">
      <span data-field-label="true">{label}</span>
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

export function TextAreaField({
  characterLimit,
  className,
  error,
  hint,
  label,
  onChange,
  ...props
}: TextAreaFieldProps) {
  const resolvedError = error ?? useFormFieldError(props.name);
  const generatedId = useId();
  const resolvedControlId = props.id ?? generatedId;
  const characterCountId = characterLimit ? `${resolvedControlId}-character-count` : undefined;
  const [characterCount, setCharacterCount] = useState(() => textAreaValueLength(props.value ?? props.defaultValue));

  useEffect(() => {
    if (props.value === undefined) return;
    setCharacterCount(textAreaValueLength(props.value));
  }, [props.value]);

  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    resolvedControlId,
    props["aria-describedby"],
    hint,
    resolvedError,
    props["aria-invalid"],
    [characterCountId],
  );
  const remainingCharacters = characterLimit ? characterLimit - characterCount : 0;
  return (
    <label className={fieldClassName(className)} data-field-root="true">
      <span data-field-label="true">{label}</span>
      <textarea
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete={props.autoComplete ?? "off"}
        id={controlId}
        onChange={(event) => {
          setCharacterCount(event.currentTarget.value.length);
          onChange?.(event);
        }}
      />
      {hintNode}
      {characterLimit ? (
        <small
          className="workbenchFieldCharacterCount"
          data-over-limit={remainingCharacters < 0 ? "true" : undefined}
          id={characterCountId}
        >
          {remainingCharacters >= 0
            ? `还可输入 ${remainingCharacters} 个字符`
            : `已超出 ${Math.abs(remainingCharacters)} 个字符`}
        </small>
      ) : null}
      {errorNode}
    </label>
  );
}

export function SelectField({ children, className, error, hint, label, ...props }: SelectFieldProps) {
  const resolvedError = error ?? useFormFieldError(props.name);
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    resolvedError,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)} data-field-root="true">
      <span data-field-label="true">{label}</span>
      <select {...props} aria-describedby={describedBy} aria-invalid={invalid} id={controlId}>
        {children}
      </select>
      {hintNode}
      {errorNode}
    </label>
  );
}

export function FileField({ className, error, hint, label, ...props }: FileFieldProps) {
  const resolvedError = error ?? useFormFieldError(props.name);
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    resolvedError,
    props["aria-invalid"],
  );
  return (
    <label className={fieldClassName(className)} data-field-root="true">
      <span data-field-label="true">{label}</span>
      <input {...props} aria-describedby={describedBy} aria-invalid={invalid} id={controlId} />
      {hintNode}
      {errorNode}
    </label>
  );
}

export function CheckboxField({ className, error, hint, label, ...props }: CheckboxFieldProps) {
  const resolvedError = error ?? useFormFieldError(props.name);
  const { controlId, describedBy, errorNode, hintNode, invalid } = useFieldDescription(
    props.id,
    props["aria-describedby"],
    hint,
    resolvedError,
    props["aria-invalid"],
  );
  return (
    <label className={["workbenchCheckboxField", className].filter(Boolean).join(" ")} data-field-root="true">
      <input
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        id={controlId}
        type={props.type ?? "checkbox"}
      />
      <span data-field-label="true">{label}</span>
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
  extraDescriptionIds: Array<string | undefined> = [],
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const mergedDescription = [describedBy, hintId, ...extraDescriptionIds, errorId].filter(Boolean).join(" ") || undefined;
  return {
    controlId,
    describedBy: mergedDescription,
    errorNode: error ? <small className="workbenchFieldError" id={errorId}><span className="visuallyHidden">Error: </span>{error}</small> : null,
    hintNode: hint ? <small className="workbenchFieldHint" id={hintId}>{hint}</small> : null,
    invalid: ariaInvalid ?? (error ? true : undefined),
  };
}

function textAreaValueLength(value: TextareaHTMLAttributes<HTMLTextAreaElement>["value"] | undefined) {
  if (Array.isArray(value)) return value.join("").length;
  if (value === undefined || value === null) return 0;
  return String(value).length;
}

function fieldClassName(className: string | undefined) {
  return ["workbenchField", className].filter(Boolean).join(" ");
}
