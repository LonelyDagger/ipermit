import { config } from '../dist/index.js';
import { addParent, ascertainAncestors, createEntity } from '../dist/Entity.js';
import { ObjectId } from 'mongodb';
//Remember to clean db after testing.
await config({ dataProvider: { type: 'mongodb' } });
const a = await createEntity();
const b = await createEntity();
await addParent(a, b);
console.log(await ascertainAncestors(a));