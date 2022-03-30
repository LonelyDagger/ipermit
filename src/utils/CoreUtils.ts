export function ensureElement<T>(array: Array<T>, element: T): Array<T> {
  if (!array.includes(element))
    array.push(element);
  return array;
}