export type TimeSpan = string | number | false;

export function getMsFromTimeSpan(def: TimeSpan): number {
  if (typeof def === 'number') return def;
  if (def === false) return 0;
  //TODO Convert string literals like 5s, 100ms to number
  throw new Error('Not implemented yet.');
}