// Display meters with cm precision, e.g. "3.40 m".
export function formatMeters(m: number): string {
  return `${m.toFixed(2)} m`;
}
