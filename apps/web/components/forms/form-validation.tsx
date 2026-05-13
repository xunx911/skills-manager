"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, FormHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from "react";

import { requiredFieldMessage, type RequiredControlKind } from "@/components/forms/form-validation-copy";
import { isApiError, type ApiFieldError } from "@/lib/api-errors";

export { requiredFieldMessage };
export type FormFieldError = {
  fieldId: string | null;
  fieldName: string;
  message: string;
};

type ValidatedFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "noValidate" | "onSubmit"> & {
  children: ReactNode;
  onValidSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  summaryTitle?: string;
};

const FormValidationContext = createContext<Map<string, string> | null>(null);

export function ValidatedForm({
  children,
  onValidSubmit,
  summaryTitle = "检查这些字段",
  ...props
}: ValidatedFormProps) {
  const [errors, setErrors] = useState<FormFieldError[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const errorsByName = useMemo(() => new Map(errors.map((error) => [error.fieldName, error.message])), [errors]);

  useEffect(() => {
    if (errors.length === 0) return;
    const frame = window.requestAnimationFrame(() => summaryRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [errors]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const nextErrors = collectRequiredFieldErrors(form);
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    try {
      await onValidSubmit(event);
    } catch (error) {
      if (!isApiError(error) || error.fieldErrors.length === 0) {
        throw error;
      }
      setErrors(collectApiFieldErrors(form, error.fieldErrors));
    }
  }

  return (
    <FormValidationContext.Provider value={errorsByName}>
      <form {...props} noValidate onSubmit={submit}>
        {errors.length > 0 ? <FormErrorSummary errors={errors} summaryRef={summaryRef} title={summaryTitle} /> : null}
        {children}
      </form>
    </FormValidationContext.Provider>
  );
}

export function useFormFieldError(name: string | undefined) {
  const errorsByName = useContext(FormValidationContext);
  if (!name) return undefined;
  return errorsByName?.get(name);
}

function FormErrorSummary({
  errors,
  summaryRef,
  title,
}: {
  errors: FormFieldError[];
  summaryRef: React.RefObject<HTMLDivElement | null>;
  title: string;
}) {
  return (
    <div aria-label={title} className="formErrorSummary" ref={summaryRef} role="alert" tabIndex={-1}>
      <strong>{title}</strong>
      <p>修正后再提交。</p>
      <ul>
        {errors.map((error) => {
          const fieldId = error.fieldId;
          return (
            <li key={`${error.fieldName}-${fieldId}`}>
              {fieldId ? (
                <a href={`#${fieldId}`} onClick={(event) => focusLinkedField(event, fieldId)}>
                  {error.message}
                </a>
              ) : (
                <span>{error.message}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function collectRequiredFieldErrors(form: HTMLFormElement) {
  const controls = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input[required], textarea[required], select[required]",
    ),
  );
  const errors: FormFieldError[] = [];

  for (const control of controls) {
    if (!shouldValidateControl(control) || controlHasValue(control)) continue;
    const label = fieldLabel(control);
    errors.push({
      fieldId: control.id,
      fieldName: control.name,
      message: control.dataset.requiredMessage || requiredFieldMessage(label, controlKind(control)),
    });
  }

  return errors;
}

function collectApiFieldErrors(form: HTMLFormElement, fieldErrors: ApiFieldError[]) {
  return fieldErrors.map((error) => {
    const control = formControlForField(form, error.field);
    return {
      fieldId: control?.id ?? null,
      fieldName: control?.name ?? error.field,
      message: error.message,
    };
  });
}

function formControlForField(form: HTMLFormElement, fieldName: string) {
  const candidate = form.elements.namedItem(fieldName);
  if (isSupportedControl(candidate)) return candidate;
  if (candidate instanceof RadioNodeList) return Array.from(candidate).find(isSupportedControl);
  return undefined;
}

function isSupportedControl(
  control: Element | RadioNodeList | null | undefined,
): control is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement;
}

function shouldValidateControl(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  return Boolean(control.name) && Boolean(control.id) && !control.disabled && control.type !== "hidden";
}

function controlHasValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox" || control.type === "radio") return control.checked;
    if (control.type === "file") return Boolean(control.files && control.files.length > 0);
  }
  return control.value.trim().length > 0;
}

function controlKind(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): RequiredControlKind {
  if (control instanceof HTMLInputElement) {
    if (control.type === "file") return "file";
    if (control.type === "checkbox" || control.type === "radio") return "checkbox";
  }
  return "text";
}

function fieldLabel(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const fieldRoot = control.closest("[data-field-root='true']");
  const label = fieldRoot?.querySelector("[data-field-label='true']")?.textContent?.trim();
  return label || control.name;
}

function focusLinkedField(event: ReactMouseEvent<HTMLAnchorElement>, fieldId: string) {
  event.preventDefault();
  document.getElementById(fieldId)?.focus();
}
