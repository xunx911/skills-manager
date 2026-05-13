"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldBaseProps = {
  className?: string;
  hint?: ReactNode;
  label: string;
};

type TextFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextAreaFieldProps = FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectFieldProps = FieldBaseProps & SelectHTMLAttributes<HTMLSelectElement>;
type FileFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement> & {
  directory?: string;
  webkitdirectory?: string;
};

export function TextField({ className, hint, label, ...props }: TextFieldProps) {
  const { controlId, describedBy, hintNode } = useFieldDescription(props.id, props["aria-describedby"], hint);
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <input {...props} aria-describedby={describedBy} autoComplete={props.autoComplete ?? "off"} id={controlId} />
      {hintNode}
    </label>
  );
}

export function TextAreaField({ className, hint, label, ...props }: TextAreaFieldProps) {
  const { controlId, describedBy, hintNode } = useFieldDescription(props.id, props["aria-describedby"], hint);
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <textarea {...props} aria-describedby={describedBy} autoComplete={props.autoComplete ?? "off"} id={controlId} />
      {hintNode}
    </label>
  );
}

export function SelectField({ children, className, hint, label, ...props }: SelectFieldProps) {
  const { controlId, describedBy, hintNode } = useFieldDescription(props.id, props["aria-describedby"], hint);
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <select {...props} aria-describedby={describedBy} id={controlId}>
        {children}
      </select>
      {hintNode}
    </label>
  );
}

export function FileField({ className, hint, label, ...props }: FileFieldProps) {
  const { controlId, describedBy, hintNode } = useFieldDescription(props.id, props["aria-describedby"], hint);
  return (
    <label className={fieldClassName(className)}>
      <span>{label}</span>
      <input {...props} aria-describedby={describedBy} id={controlId} />
      {hintNode}
    </label>
  );
}

function useFieldDescription(id: string | undefined, describedBy: string | undefined, hint: ReactNode) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const mergedDescription = [describedBy, hintId].filter(Boolean).join(" ") || undefined;
  return {
    controlId,
    describedBy: mergedDescription,
    hintNode: hint ? <small className="workbenchFieldHint" id={hintId}>{hint}</small> : null,
  };
}

function fieldClassName(className: string | undefined) {
  return ["workbenchField", className].filter(Boolean).join(" ");
}
