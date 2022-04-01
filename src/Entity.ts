import { Collection, Db, ObjectId } from 'mongodb';
import { getDefaultDb } from './MongoDBProvider.js';
import { ensureElementsUnique, ensureObjectId } from './utils/CoreUtils.js';
import ProjectionMap from './utils/ProjectionMap.js';

/**
 * Represent an entity.
 * 
 * You can add your own properties to the prototype or instances.
 * 
 * An instance of this class only acts as a provider of ObjectId. Methods like `modifyEntity` and `addParent` **won't** modify `Entity` instance.
 */
export class Entity {
  _id: ObjectId;
  parents: ProjectionMap<string, ObjectId>;
  [otherProp: string | number | symbol]: any;

  constructor(_id: ObjectId, parents?: Iterable<ObjectId> | ProjectionMap<string, ObjectId>) {
    this._id = _id;
    if (parents instanceof ProjectionMap<string, ObjectId>)
      parents = parents.values();
    this.parents = new ProjectionMap((o) => o.toString(), parents);
  }
}

function getEntityCollection(db?: Db): Collection {
  return (db ?? getDefaultDb()).collection('entities');
}

export async function retrieveEntity(obj: ObjectId | Entity, externalProjection: { [key: string]: number } = {}, coll: Collection = getEntityCollection()): Promise<Entity> {
  if (!(obj instanceof ObjectId))
    return obj;
  const qresult = await coll.findOne<Entity>({ _id: obj }, { projection: Object.assign(externalProjection, { _id: 1, parents: 1 }) });
  if (!qresult)
    throw new Error(`Unable to retrieve the specified entity`);
  const result = new Entity(obj, qresult.parents);
  for (let k in externalProjection)
    result[k] = qresult[k];
  return result;
}

/**
 * Modify custom properties of an entity.
 * 
 * This method is **not applicable** to preserved fields like `parents`.
 * @param obj ObjectId or ObjectId provider.
 * @param propsToChange A object conveyed directly to `updateOne` method.
 * @param coll 
 */
export async function modifyEntity(obj: ObjectId | Entity, propsToChange: { [key: string]: any }, coll: Collection = getEntityCollection()) {
  const oid = ensureObjectId(obj);
  await coll.updateOne({ _id: oid }, { $set: propsToChange });
}

export async function createEntity(parents?: Iterable<ObjectId>, coll: Collection = getEntityCollection()): Promise<Entity> {
  const doc: { parents?: ObjectId[] } = {};
  if (parents)
    doc.parents = [...ensureElementsUnique(parents, (e) => e.toString())];
  const result = await coll.insertOne(doc);
  return new Entity(result.insertedId, parents);
}

export async function addParent(target: Entity | ObjectId, parent: Entity | ObjectId, coll: Collection = getEntityCollection()) {
  const isId = target instanceof ObjectId;
  const pid = ensureObjectId(parent);
  await coll.updateOne({ _id: isId ? target : target._id }, { $addToSet: { parents: pid } });
}

export async function ascertainAncestors(node: Entity | ObjectId, coll: Collection = getEntityCollection()): Promise<Iterable<ObjectId>> {
  node = await retrieveEntity(node, undefined, coll);
  const parents = node.parents;
  const results = new ProjectionMap((v: ObjectId) => v.toString());
  for (let p of parents.values()) {
    if (results.get(p.toString()))
      continue;
    results.addValue(p);
    results.addValues(await ascertainAncestors(p, coll));
  }
  return results.values();
}