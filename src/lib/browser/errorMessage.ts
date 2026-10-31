/** Describe an unknown thrown value for display: an Error's message, otherwise its string conversion. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
