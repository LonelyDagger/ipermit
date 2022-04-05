import { BSONType, ObjectId } from 'mongodb';
import { ascertainAncestors, Entity, retrieveEntity } from './Entity.js';
import { findPolicies, Policy } from './Policy.js';
import { Resource, retrieveResource } from './Resource.js';
import { ensureObjectId, ObjectIdProvidable } from './utils/CoreUtils.js';

export { TimeSpan } from './utils/TimeSpan.js';
export { MongoDBProvider, CacheConfig, CacheType, IPermitConfig, config } from './IPermitConfig.js';
export * from './Entity.js';
export * from './Resource.js';
export * from './Policy.js';

export interface CheckPermContext {
  requester: ObjectId;
  access: string | string[];
  resource: ObjectId;
}

export async function retrieveRelevantPolicies(resource: Resource): Promise<Policy[]> {
  let resOwnerFilter;
  if (resource.owner) {
    const anc = await ascertainAncestors(resource.owner, true);
    resOwnerFilter = {
      $and: [
        { 'selector.resourceOwner': { $type: BSONType.object } },
        { 'selector.resourceOwner.id': { $in: [null, '*', resource.owner] } },
        { 'selector.resourceOwner.subof': { $in: [null, '*', ...anc] } }
      ]
    };
  }
  else resOwnerFilter = {
    $or: [
      { 'selector.resourceOwner': { $in: ['none'] } },
      { 'selector.resourceOwner.id': { $in: ['none'] } }
    ]
  };
  return (await (await findPolicies({
    $or: [
      { selector: '*' },
      {
        $and: [
          { selector: { $type: BSONType.object } },
          { 'selector.resourceType': { $in: [null, '*', resource.type] } },
          {
            $or: [
              { 'selector.resourceOwner': { $in: [null, '*'] } },
              resOwnerFilter
            ]
          }
        ]
      },
      (resource.boundPolicies && resource.boundPolicies.length) ? { _id: { $in: resource.boundPolicies } } : {}
    ]
  }, { sort: { priority: -1 }, projection: { _id: 1, contents: 1, priority: 1 } })).toArray()).map(({ _id, ...otherProps }) => new Policy(_id, otherProps));
}

const defaultCompounder = {
  callback({ reactions }: CompounderContext) {
    let allowed;
    for (let r of reactions) {
      if (r === false)
        return false;
      if (r === true)
        allowed = true;
    }
    if (allowed)
      return true;
    throw new Error('No policy reacted. Ensure at least one fallback policy is provided');
  },
  type: <'conclude'>'conclude'
};

export async function checkPerm({ requester, access, resource }: { requester: ObjectIdProvidable | Entity, access: string, resource: ObjectIdProvidable | Resource }, { callback, type = 'conclude' }: { callback: ReactionCompounder, type?: 'each' | 'conclude' | 'all' } = defaultCompounder): Promise<boolean> {
  // const requesterIns = requester instanceof Entity ? requester : await retrieveEntity(requester);
  const resourceIns = resource instanceof Resource ? resource : await retrieveResource(resource);
  const policies = await retrieveRelevantPolicies(resourceIns);
  const checkContext: CheckPermContext = { requester: ensureObjectId(requester), access, resource: ensureObjectId(resource) };
  const compounderContext: CompounderContext = { policies, index: 0, reaction: null, reactions: new Array(policies.length) };
  for (; compounderContext.index < policies.length; compounderContext.index++) {
    compounderContext.reaction = (await policies[compounderContext.index].applyTo(checkContext));
    compounderContext.reactions[compounderContext.index] = compounderContext.reaction;
    if (type === 'each' || type === 'all') {
      let er = callback(compounderContext);
      if (typeof er === 'boolean')
        return er;
    }
  }
  if (type === 'conclude' || type === 'all') {
    let cr = callback(compounderContext);
    if (typeof cr === 'boolean')
      return cr;
  }
  throw new Error('Invalid result from ReactionCompounder');
}


interface CompounderContext {
  policies: Policy[];
  reactions: (boolean | null)[];
  index: number;
  reaction: boolean | null;
}

export type ReactionCompounder = (compounderContext: CompounderContext) => boolean | null;