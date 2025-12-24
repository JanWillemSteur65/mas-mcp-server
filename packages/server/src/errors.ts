export type DeterministicError = {
  ok: false;
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
};

export function err(code: string, message: string, details?: any, retryable = false): DeterministicError {
  return { ok: false, code, message, details, retryable };
}

export function isDeterministicError(x: any): x is DeterministicError {
  return Boolean(x && x.ok === false && typeof x.code === "string" && typeof x.message === "string");
}
