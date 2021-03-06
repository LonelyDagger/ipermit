import { ObjectId } from 'mongodb';
import ProjectionMap from './ProjectionMap.js';

export function ensureElementsUnique<T>(iterable?: Iterable<T>, keyProjector: (element: T) => any = e => e): Iterable<T> {
  if (!iterable) return [];
  const pmap = new ProjectionMap(keyProjector, iterable);
  return pmap.values();
}

export type ObjectIdProvidable = undefined | string | ObjectId | { _id: ObjectId };
export function ensureObjectId(value: ObjectIdProvidable, requireExisted: boolean = false): ObjectId {
  if (requireExisted && !value)
    throw new Error('Require an existent ObjectId');
  if (value instanceof ObjectId)
    return value;
  return (typeof value === 'object' && '_id' in value) ? value._id : new ObjectId(value);
}

export function ensureStringArray(value: string | string[]) {
  if (typeof value === 'string') return [value];
  return value;
}

export function isSubsetOf<T>(self: T | T[], target: T[]): boolean {
  if (!Array.isArray(self))
    return target.includes(self);
  for (let s of self)
    if (!target.includes(s))
      return false;
  return true;
}

export function toDotNotation(obj: { [k: string]: any }): { [k: string]: any } {
  const r: { [k: string]: any } = {};
  for (let k in obj) {
    if (typeof obj[k] === 'object') {
      let m;
      const i = toDotNotation(obj[k]);
      for (let s in i) {
        r[`${k}.${s}`] = i[s];
        m = true;
      }
      if (!m) r[k] = {};
    }
    else r[k] = obj[k];
  }
  return r;
}