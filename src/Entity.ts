import { Collection, Db, ObjectId } from "mongodb";
import { getDefaultDb } from "./MongoDBProvider.js";

export class Entity {
  _id: ObjectId;
  parents: Set<ObjectId>;
  [otherProp: string | number | symbol]: any;

  constructor(_id: ObjectId, parents?: Iterable<ObjectId>) {
    this._id = _id;
    if (parents) this.parents = new Set(parents);
    else this.parents = new Set();
  }
}

function getEntityCollection(db?: Db) {
  return (db ?? getDefaultDb()).collection('entities');
}

export async function createEntity(parents: Set<ObjectId> = new Set(), coll: Collection = getEntityCollection()): Promise<Entity> {
  const result = await coll.insertOne({ parents: [...parents] });
  return new Entity(result.insertedId, parents);
}

export async function addParent(target: Entity | ObjectId, parent: Entity | ObjectId, coll: Collection = getEntityCollection()) {
  const isId = target instanceof ObjectId;
  const pid = parent instanceof ObjectId ? parent : parent._id;
  await coll.updateOne({ _id: isId ? target : target._id }, { $addToSet: { parents: pid } });
  if (!isId) target.parents.add(pid);
}

export async function ascertainAncestors(leaf: Entity | ObjectId, coll: Collection = getEntityCollection()): Promise<Iterable<ObjectId>> {
  if (leaf instanceof ObjectId)
    leaf = <Entity>await coll.findOne<Entity>({ _id: leaf }, { projection: { _id: 1, parents: 1 } });
  const results = new Map();
  const parents = leaf.parents;
  results.set(leaf._id.toHexString(), parents);
  for (let p of parents) {
    if (results.get(p.toHexString()))
      continue;
    results.set(p.toHexString(), await ascertainAncestors(p));
  }
  return [...parents].flat(2);
}