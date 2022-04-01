import { config } from '../dist/index.js';
import { addParent, ascertainAncestors, createEntity } from '../dist/Entity.js';
import { getDefaultDb } from "../dist/MongoDBProvider.js";
import { ObjectId } from 'mongodb';
//Remember to clean db after testing.
await config({ dataProvider: { type: 'mongodb' } });
let t = await createEntity();
const base = t;
for (let i = 0; i < 10; i++) {
  let p = await createEntity();
  await addParent(t, p);
  t = p;
}
console.log([...await ascertainAncestors(base)]);

process.exit();