import { checkPerm, config, createEntity, modifyEntity, createResource, ensurePolicies, createPolicy, addCustomCheckOps } from '../dist/index.js';
import { ObjectId } from 'mongodb';

//Remember to clean db after testing.
await config({ dataProvider: { type: 'mongodb' } });
let a = await createEntity();
let b = await createEntity();
await modifyEntity(a, { parents: [b._id] });
addCustomCheckOps({ myTest: (def) => (e) => e.requester.equals(def) });
await ensurePolicies([{
  selector: '*',
  contents: [{ check: {}, react: false }],
  priority: -500
}]);
let p = await createPolicy({
  selector: undefined,
  contents: [{
    check: {
      access: ['read', 'write', 'applyPolicy'],
      requester: {
        id: a._id,
        subof: b._id
      },
      myTest: b._id,
    },
    react: true
  }]
});
let r = await createResource({ type: 'testRes', boundPolicies: [p._id] });
console.log(await checkPerm({ requester: b, access: ['read'], resource: r }))

process.exit();