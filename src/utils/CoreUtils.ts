import { ObjectId } from 'mongodb';
import ProjectionMap from './ProjectionMap.js';

export function ensureElementsUnique<T>(iterable: Iterable<T>, keyProjector: (element: T) => any = e => e): Iterable<T> {
  const pmap = new ProjectionMap(keyProjector, iterable);
  return pmap.values();
}

export function ensureObjectId(value: ObjectId | { _id: ObjectId }): ObjectId { return value instanceof ObjectId ? value : value._id; }