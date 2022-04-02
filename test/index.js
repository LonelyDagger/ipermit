import { checkPerm, config, addParent, createEntity, createResource, createPolicy } from '../dist/index.js';
import { ObjectId } from 'mongodb';

//Remember to clean db after testing.
await config({ dataProvider: { type: 'mongodb' } });
let a = await createEntity();
let b = await createEntity();
await addParent(a, b);
let p = await createPolicy({
  selector: undefined,
  contents: [{
    check: {
      access: ['read', 'write', 'applyPolicy'],
      requester: {
        id: a._id,
        subof: b._id
      }
    },
    react: true
  }]
});
let r = await createResource({ type: 'testRes', boundPolicies: [p._id] });
console.log(await checkPerm({ requester: a, access: ['write', 'read'], resource: r }))

process.exit();