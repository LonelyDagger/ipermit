import { Db, MongoClient } from "mongodb";

export async function connect(from: string | MongoClient): Promise<MongoClient> {
  if (typeof from === 'string')
    return await new MongoClient(from, { appName: 'IPermit' }).connect();
  else
    return from;
}

async function ensureCollection(db: Db, collName: string, collOptions: Object, createNew: boolean) {
  if (createNew)
    return await db.createCollection(collName, collOptions);
  else {
    await db.command(Object.assign({ collMod: collName }, collOptions));
    return db.collection(collName);
  }
}

export async function prepareDatabase(client: MongoClient, database?: string, prefix?: string): Promise<Db> {
  let db = client.db(database);
  let pf = prefix ?? '';
  let colls = (await db.collections()).map((c) => c.collectionName);
  let entityCollectionName = `${pf}entities`;
  let entityCollection = await ensureCollection(db, entityCollectionName, {
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
  }, !colls.includes(entityCollectionName));
  await entityCollection.createIndexes([
    {
      key: { _id: 1 }
    }
  ]);
  let resourceCollectionName = `${pf}resources`;
  let resourceCollection = await ensureCollection(db, resourceCollectionName, {
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
  }, !colls.includes(resourceCollectionName));
  await resourceCollection.createIndexes([
    {
      key: { _id: 1 }
    }
  ]);
  let policyCollectionName = `${pf}policy`;
  let policyCollection = await ensureCollection(db, policyCollectionName, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        additionalProperties: true,
        required: ['_id', 'content'],
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
          content: {
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
  }, !colls.includes(policyCollectionName));
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