import { Collection, ObjectId } from "mongodb";
import { ascertainAncestors, Entity } from "./Entity.js";
import { CheckPermContext } from "./index.js";
import { createExtendable, Datum, globalDefaultProivder } from "./MongoDBProvider.js";
import { ensureElementsUnique, ensureStringArray, isSubsetOf } from "./utils/CoreUtils.js";

export type ObjectIdDescriber = ObjectId;

export interface EntityIdEquals { id: ObjectIdDescriber; }
export interface EntitySubOf { subof: ObjectIdDescriber; }
export type EntityRestrictorObject = EntityIdEquals | EntitySubOf | { [customOpName: string]: any };
export type EntityRestrictor = EntityRestrictorObject | '*';

export interface RequesterCondtion { requester: EntityRestrictor; }
export interface ResourceIdCondtion { resourceId: ObjectIdDescriber; }
export interface AccessCondition { access: string | string[]; }
export interface NotCondition { not: PolicyCheckCondition; }
export interface NorCondition { nor: PolicyCheckCondition[]; }
export interface OrCondition { or: PolicyCheckCondition[]; }
export interface AndCondition { and: PolicyCheckCondition[]; }
export type PolicyCheckCondition = RequesterCondtion | ResourceIdCondtion | AccessCondition | NotCondition | NorCondition | OrCondition | AndCondition | { [customOpName: string]: any };

export type PolicyCheck = PolicyCheckCondition;
export type PolicyReact = boolean | undefined;

export interface PolicySelectorObject {
  resourceOwner?: EntityRestrictor;
  resourceType?: string;
}
export type PolicySelector = PolicySelectorObject | '*';
export interface PolicyContent {
  check: PolicyCheck;
  react: PolicyReact;
}

interface EntityRestrictorOps { [name: string]: (value: any) => ((entity: Entity) => boolean); }
const customEntityRestrictorOps: EntityRestrictorOps = {};
export function addCustomEntityRestrictorOps(v: EntityRestrictorOps) {
  Object.assign(customEntityRestrictorOps, v);
}
export function compileEntityRestrictor(origin: EntityRestrictorObject): (entity: Entity) => Promise<boolean> {
  const terms: ((entity: Entity) => Promise<boolean> | boolean)[] = [];
  for (let k in origin) {
    let t: (entity: Entity) => Promise<boolean> | boolean;
    switch (k) {
      case 'id': {
        const v = new ObjectId((<EntityIdEquals>origin).id);
        t = (e) => v.equals(e._id);
        break;
      }
      case 'subof': {
        const v = new ObjectId((<EntityIdEquals>origin).id);
        t = async (entity: Entity) => {
          if (v.equals(entity._id)) return true;
          const iterator = await ascertainAncestors(entity);
          for (let i of iterator)
            if (i.equals(entity._id)) return true;
          return false;
        };
        break;
      }
      default:
        const co = customEntityRestrictorOps[k];
        if (typeof co === 'function') {
          t = co((<any>origin)[k]);
          break;
        }
        throw new Error('Unknown EntityRestictor definition');
    }
    terms.push(t);
  }
  return LogicalAnd(terms);
}

interface CheckOps { [name: string]: (value: any) => ((context: CheckPermContext) => boolean); }
const customCheckOps: CheckOps = {};
export function addCustomCheckOps(v: CheckOps) {
  Object.assign(customCheckOps, v);
}
export function compileCheck(origin: PolicyCheckCondition): (context: CheckPermContext) => Promise<boolean> | boolean {
  const terms: ((context: CheckPermContext) => Promise<boolean> | boolean)[] = [];
  for (let k in origin) {
    let t: (context: CheckPermContext) => Promise<boolean> | boolean;
    switch (k) {
      case 'requester': {
        const r = (<RequesterCondtion>origin).requester;
        if (r === '*') {
          t = () => true;
          break;
        }
        const v = compileEntityRestrictor(r);
        t = async (context: CheckPermContext) => await v(context.requester);
        break;
      }
      case 'resourceId': {
        const v = new ObjectId((<ResourceIdCondtion>origin).resourceId);
        t = (context: CheckPermContext) => v.equals(context.resource._id);
        break; 
      }
      case 'access': {
        const allowedAccess = [...ensureElementsUnique(ensureStringArray((<AccessCondition>origin).access))];
        t = (context: CheckPermContext) => isSubsetOf(context.access, allowedAccess);
        break;
      }
      case 'not':
        t = LogicalNot(compileCheck((<NotCondition>origin).not));
        break;
      case 'nor':
        t = LogicalNot(LogicalOr((<NorCondition>origin).nor.map(compileCheck)));
        break;
      case 'or':
        t = LogicalOr((<OrCondition>origin).or.map(compileCheck));
        break;
      case 'and':
        t = LogicalAnd((<AndCondition>origin).and.map(compileCheck));
        break;
      default:
        const co = customCheckOps[k];
        if (typeof co === 'function') {
          t = co((<any>origin)[k]);
          break;
        }
        throw new Error('Unknown PolicyCheck definition');
    }
    terms.push(t);
  }
  if (terms.length === 0)
    return () => true;
  if (terms.length === 1)
    return terms[0];
  return LogicalAnd(terms);
}

function LogicalNot<T>(term: ((arg: T) => Promise<boolean> | boolean)): (arg: T) => Promise<boolean> {
  return async (arg: T) => !await term(arg);
}
function LogicalOr<T>(terms: ((arg: T) => Promise<boolean> | boolean)[]): (arg: T) => Promise<boolean> {
  return async (arg: T) => {
    for (let t of terms)
      if (await t(arg)) return true;
    return false;
  }
}
function LogicalAnd<T>(terms: ((arg: T) => Promise<boolean> | boolean)[]): (arg: T) => Promise<boolean> {
  return async (arg: T) => {
    for (let t of terms)
      if (!await t(arg)) return false;
    return true;
  }
} 

function getPolicyCollection(): Collection { return <Collection>globalDefaultProivder.policyCollection; }

export class Policy extends Datum {
  selector?: PolicySelector;
  contents: PolicyContent[];
  priority: number;

  constructor({ selector, contents, priority = 0, ...otherProps }: { _id?: ObjectId, selector?: PolicySelector, contents?: Iterable<PolicyContent>, priority?: number, [k: string]: any } = {}) {
    super(otherProps);
    this.selector = selector;
    this.contents = [...ensureElementsUnique(contents)];
    this.priority = priority;
  }

  async applyTo(context: CheckPermContext): Promise<boolean | null> {
    let allowed;
    for (let c of this.contents) {
      const f = compileCheck(c.check);
      if (await f(context))
        switch (c.react) {
          case false:
            return false;
          case true:
            allowed = true;
            break;
        }
    }
    if (allowed)
      return true;
    return null;
  }
}

/**
 * Ensure the specified policies exist, otherwise insert them with a generated `_id`. Replace or insert the document with specified `_id` if provided.
 * 
 * Any field except `_id` differing from existent document may result in inserting a new document. If this is not expected, please provide a constant `_id`.
 */
export async function ensurePolicies(policies: Iterable<Policy>, coll: Collection = getPolicyCollection()) {
  for (let p of policies) {
    const { _id, ...otherProps } = p;
    if (_id instanceof ObjectId) {
      await coll.replaceOne({ _id: p._id }, otherProps, { upsert: true });
    }
    else await coll.updateOne(p, { $set: p }, { upsert: true });
  }
}

export const { retrieve: retrievePolicy, modify: modifyPolicy, create: createPolicy, delete: deletePolicy, find: findPolicies } = createExtendable(getPolicyCollection, ['owner'], Policy);