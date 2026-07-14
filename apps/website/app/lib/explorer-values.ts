export function formatJson(value: unknown) {
  const formatted = JSON.stringify(value, null, 2);
  return formatted === undefined ? null : formatted;
}

export function parseJson(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return { status: 'valid' as const, value: parsed };
  } catch (error) {
    return {
      status: 'invalid' as const,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}
