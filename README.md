# IPermit
IPermit is a universal permission managing framework for Node, no matter what scale your application is.

### Status
IPermit is still working in progress. It may not be able to work right now.
However, its core concepts should be fully described in Github Wiki, so you can put into use as long as a standard version released, or contribute following the concepts.

### How to use
After a standrad version(1.0.x) releases, use `npm i -S ipermit`
```js
import { provideConfig, checkPerm } from 'ipermit';
provideConfig({dataProvider: {type: 'mongodb', connectionString: '...'}})
//...
if(!checkPerm({resource: 'resourceId', entity: 'entityId', operation: 'read'}))
  return {code: 403,message: 'Operation not permitted'};
```


### Requirements
#### Runtime
Node12+ is supported.
#### Data provider
IPermit needs a data provider to retrive and write data.

It will support MongoDB officially, and will provide data access interfaces in future releases.