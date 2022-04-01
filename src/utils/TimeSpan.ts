export type TimeSpan = string | number | false | undefined | null;

export function getMsFromTimeSpan(def: TimeSpan): number {
  if (!def) return 0;
  if (typeof def === 'number') return def;
  //TODO Convert string literals like 5s, 100ms to number
  throw new Error('Not implemented yet.');
}