export type ApiFieldError = {
  field: string;
  message: string;
  code?: string;
};

type ApiErrorPayload = {
  detail?: unknown;
  field_errors?: unknown;
};

export class ApiError extends Error {
  readonly fieldErrors: ApiFieldError[];
  readonly status: number;

  constructor(message: string, status: number, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return new ApiError(errorMessage(payload, response), response.status, fieldErrors(payload.field_errors));
  } catch {
    return new ApiError(`${response.status} ${response.statusText}`, response.status);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function errorMessage(payload: ApiErrorPayload, response: Response) {
  if (typeof payload.detail === "string") return payload.detail;
  if (payload.detail !== undefined) return JSON.stringify(payload.detail);
  return `${response.status} ${response.statusText}`;
}

function fieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.field !== "string" || typeof candidate.message !== "string") return [];
    return [
      {
        field: candidate.field,
        message: candidate.message,
        ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      },
    ];
  });
}
