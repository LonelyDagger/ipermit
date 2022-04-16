import { Collection, Db, Filter, FindOptions, MongoClient, ObjectId } from 'mongodb';
import { ensureObjectId, ObjectIdProvidable } from './utils/CoreUtils.js';

export const globalDefaultProivder: { client?: MongoClient, db?: Db, entityCollection?: Collection, resourceCollection?: Collection, policyCollection?: Collection } = {};
export function setGlobalDefaultProvider(client: MongoClient, db: Db, prefix: string = '') {
  globalDefaultProivder.client = client;
  globalDefaultProivder.db = db;
  globalDefaultProivder.entityCollection = db.collection(`${prefix}entities`);
  globalDefaultProivder.resourceCollection = db.collection(`${prefix}resources`);
  globalDefaultProivder.policyCollection = db.collection(`${prefix}policies`);
}

export async function connect(from: string | MongoClient): Promise<MongoClient> {
  if (typeof from === 'string')
    return await new MongoClient(from, { appName: 'IPermit' }).connect();
  else
    return from;
}
export async function disconnect() {
  return await globalDefaultProivder.client?.close?.();
}

async function ensureCollection(db: Db, collName: string, collOptions?: Object, createNew: boolean = true) {
  if (createNew)
    return await db.createCollection(collName, collOptions);
  else {
    if (collOptions)
      await db.command(Object.assign({ collMod: collName }, collOptions));
    return db.collection(collName);
  }
}

export async function prepareDatabase(client: MongoClient, database?: string, prefix?: string, useValidation: boolean = true): Promise<Db> {
  let db = client.db(database);
  let pf = prefix ?? '';
  let colls = (await db.collections()).map((c) => c.collectionName);
  let entityCollectionName = `${pf}entities`;
  let entityCollection = await ensureCollection(db, entityCollectionName, useValidation ? {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        additionalProperties: true,
        required: ['_id'],
        properties: {
          _id: {
            bsonType: 'objectId'
          },
          perents: {
            bsonType: 'array',
            items: {
              bsonType: 'objectId'
            },
            uniqueItems: true
          }
        }
      }
    }
  } : undefined, !colls.includes(entityCollectionName));
  await entityCollection.createIndexes([
    {
      key: { _id: 1 }
    }
  ]);
  let resourceCollectionName = `${pf}resources`;
  let resourceCollection = await ensureCollection(db, resourceCollectionName, useValidation ? {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        additionalProperties: true,
        required: ['_id'],
        properties: {
          _id: {
            bsonType: 'objectId'
          },
          linkedPolicies: {
            bsonType: 'array',
            items: {
              bsonType: 'objectId'
            },
            uniqueItems: true
          }
        }
      }
    }
  } : undefined, !colls.includes(resourceCollectionName));
  await resourceCollection.createIndexes([
    {
      key: { _id: 1 }
    }
  ]);
  let policyCollectionName = `${pf}policies`;
  let policyCollection = await ensureCollection(db, policyCollectionName, useValidation ? {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        additionalProperties: true,
        required: ['_id', 'contents'],
        properties: {
          _id: {
            bsonType: 'objectId'
          },
          selector: {
            oneOf: [
              {
                bsonType: 'string',
                enum: ['*']
              },
              {
                bsonType: 'object',
                additionalProperties: true
              }
            ]
          },
          priority: {
            bsonType: 'int'
          },
          contents: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              additionalProperties: true,
              required: ['check', 'react'],
              properties: {
                check: {
                  bsonType: 'object',
                  additionalProperties: true
                },
                react: {
                  oneOf: [
                    { bsonType: 'string', enum: ['allow', 'deny'] },
                    { bsonType: 'bool' },
                  ]
                }
              }
            },
            uniqueItems: true
          }
        }
      }
    }
  } : undefined, !colls.includes(policyCollectionName));
  await policyCollection.createIndexes([
    {
      key: { _id: 1 }
    }, {
      key: { priority: -1 },
      unique: false
    }
  ]);
  return db;
}

export class ObjectIdProvider {
  _id: ObjectId;
  constructor(id: ObjectId) {
    this._id = id;
  }
}
export class Datum extends ObjectIdProvider {
  [otherProp: string | number | symbol]: any;

  constructor({ _id, ...otherProps }: DatumProps) {
    super(ensureObjectId(_id));
    Object.assign(this, otherProps);
  }

  async save(coll: Collection) {
    return await coll.updateOne({ _id: this._id }, { $set: this }, { upsert: true, serializeFunctions: false, ignoreUndefined: true })
  }
}

export interface DatumProps {
  [k: string]: any;
}

export function createExtendable<T extends { save: (coll: Collection) => Promise<any> }, P extends DatumProps>(defaultColl: Collection | (() => Collection), alwaysReturnedPropNames: string[], constructor: new (props?: P) => T) {
  const preservedProjection: { [k: string]: 1 } = { _id: 1 };
  for (let pk in alwaysReturnedPropNames)
    preservedProjection[pk] = 1;
  let getColl: () => Collection;
  if (typeof defaultColl === 'object')
    getColl = () => defaultColl;
  else getColl = defaultColl;
  return {
    async retrieve(id: ObjectIdProvidable, externalProjection?: { [keyName: string]: 1 }, coll: Collection = getColl()) {
      const oid = ensureObjectId(id, true);
      const pj = Object.assign(Object.create(preservedProjection), externalProjection);
      const qresult = await coll.findOne({ _id: oid }, { projection: pj });
      if (!qresult) throw new Error('Unable to retrieve the specified document');
      return new constructor(<P><unknown>qresult);
    },
    async modify(id: ObjectIdProvidable, propsToModify: { [k: string]: any }, coll: Collection = getColl()) {
      const oid = ensureObjectId(id);
      return await coll.updateOne({ _id: oid }, { $set: propsToModify });
    },
    async create(props: P, coll: Collection = getColl()) {
      const obj = new constructor(props);
      await obj.save(coll);
      return obj;
    },
    async delete(id: ObjectIdProvider, coll: Collection = getColl()) {
      return await coll.deleteOne({ _id: ensureObjectId(id, true) });
    },
    async find(filter: Filter<T>, options?: FindOptions, coll: Collection = getColl()) {
      return coll.find(filter, options);
    }
  };
}