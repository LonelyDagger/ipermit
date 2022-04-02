import { Collection, ObjectId } from 'mongodb';
import { createExtendable, Datum, globalDefaultProivder } from './MongoDBProvider.js';
import { ensureElementsUnique, ensureObjectId, ObjectIdProvidable } from './utils/CoreUtils.js';
import ProjectionMap from './utils/ProjectionMap.js';

function getEntityCollection(): Collection { return <Collection>globalDefaultProivder.entityCollection; }

/**
 * Represent an entity.
 * 
 * You can add your own properties to the prototype or instances.
 * 
 * An instance of this class only acts as a provider of ObjectId. Methods like `modifyEntity` and `addParent` **won't** modify `Entity` instance.
 */
export class Entity extends Datum {
  parents: ObjectId[];

  /**
   * Create a new instance of Entity.
   * 
   * Constructing an instance **does nothing to db**. Use `save` to store it.
   * @param id 
   * @param param1 An object containing initial fields. The `_id` property of this object will be ignored.
   */
  constructor(id: ObjectId, { _id, parents, ...otherProps }: { parents?: Iterable<ObjectId> | ProjectionMap<string, ObjectId>, [k: string]: any } = {}) {
    super(id, otherProps);
    if (parents instanceof ProjectionMap<string, ObjectId>)
      parents = parents.values();
    this.parents = [...ensureElementsUnique(parents)];
  }
}

export const { retrieve: retrieveEntity, modify: modifyEntity, create: createEntity, delete: deleteEntity, find: findEntities } = createExtendable(getEntityCollection, ['parents'], Entity);

export async function addParent(target: ObjectIdProvidable, parent: ObjectIdProvidable, coll: Collection = getEntityCollection()) {
  return await coll.updateOne({ _id: ensureObjectId(target, true) }, { $addToSet: { parents: ensureObjectId(parent, true) } });
}

export async function ascertainAncestors(node: ObjectIdProvidable, includeSelf: boolean = false, coll: Collection = getEntityCollection()): Promise<IterableIterator<ObjectId>> {
  const e = await retrieveEntity(node, undefined, coll);
  const parents = e.parents;
  const results = new ProjectionMap((v: ObjectId) => v.toString());
  if (includeSelf)
    results.addValue(e._id);
  for (let p of parents.values()) {
    if (results.get(p.toString()))
      continue;
    results.addValue(p);
    results.addValues(await ascertainAncestors(p, false, coll));
  }
  return results.values();
}