// Tiny classnames join — no third-party deps (no clsx).
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
