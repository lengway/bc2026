const redacted = '[redacted]';

function redact(message: string): string {
  return message
    .replace(/\b(?:set-cookie|cookie|authorization|stripe-signature|request[_ -]?body|payload)['"]?\s*[:=][^\r\n]*/gi, redacted)
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, redacted)
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, redacted)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, redacted)
    .replace(/\b(?:sk|pk|rk|whsec|tok|ctoken)_[A-Z0-9_-]+/gi, redacted)
    .replace(/\bv\d+=[A-F0-9]{16,}\b/gi, redacted)
    .replace(/\b[\w-]*_secret_[\w-]+/gi, redacted)
    .replace(/\b[\w-]*(?:secret|token|password|api[_-]?key)[\w-]*['"]?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, redacted)
    .replace(/\b[A-Z0-9_-]{40,}(?:\.[A-Z0-9_-]+)*/gi, redacted)
    .replace(/\beyJ[A-Z0-9_-]+\.[A-Z0-9_-]+\.[A-Z0-9_-]+/gi, redacted)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ');
}

function identifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const safe = redact(value);
  return /^[a-z][a-z0-9._-]{0,79}$/i.test(safe) ? safe : undefined;
}

export function reportBillingProviderFailure(operation: 'checkout' | 'portal', error: unknown): void {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = fields.statusCode ?? fields.status;
  console.error('BILLING_PROVIDER_FAILED', {
    operation,
    name: identifier(fields.name) ?? 'Error',
    type: identifier(fields.type),
    code: identifier(fields.code),
    status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined,
    message: typeof fields.message === 'string' ? redact(fields.message).slice(0, 200) : undefined,
  });
}
