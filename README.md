# IPermit
IPermit is a universal permission managing framework for Node, no matter what scale your application is.

### Status
Versions with basic features ready have been pre-released.

In short, you can use IPermit to manage permissions now. We are still working to make it easier, more efficient and more customizable.

### How to use
1. Install the package via `npm i ipermit`
2. Call `config` with connectionString and other infos
3. Create **Entities**, **Resources** and **Policies**
4. Call `checkPerm` on requests incoming
```js
import { config, checkPerm } from 'ipermit';
await config({dataProvider: {connectionString: '...'}})
//...
if(!await checkPerm({resource: 'resourceId', entity: 'entityId', access: 'read'}))
  return {code: 403, message: 'Forbidden'};
```

### Concepts
Here are some brief introductions to **Entities**, **Resources** and **Policies**.

You can add your own fields to their prototypes or instances. Use API like `modifyEntities` to save them.
#### Entities
They can be users, bots, or groups. Entity can inherit from others.
#### Resources
They represent something requires permission to access. Resource contains a list of policies bound to it.
#### Policies
They describe who can access what in which way. Policy can provide a universal model to control access, or just give certain permission.

They contain **selector**, to forcedly apply to resources, **contents**, a list of check-react pairs, and **priority**.

For example, a policy can describe that <u>owner of resource has full control</u>, then you can use selector to apply it to all resources.

Or, a policy simply contains that <u>members of group1 can read it</u>, with no selectors, then you can bind it to several resources, giving specified permission. You can also make use of selector to apply it to all resources group1 owned.

### Requirements
#### Runtime
Node12+ is supported.
#### Data provider
IPermit needs a data provider to retrive and write data.

It will support MongoDB officially, and will provide data access interfaces in future releases.