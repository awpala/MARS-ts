/** Join the nonempty element IDs of an `aria-describedby` value, or undefined when none apply so the attribute is omitted. */
export function describedBy(...ids: readonly (string | null | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}
