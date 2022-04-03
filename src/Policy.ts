import { Collection, ObjectId } from "mongodb";
import { ascertainAncestors } from "./Entity.js";
import { CheckPermContext } from "./index.js";
import { createExtendable, Datum, globalDefaultProivder } from "./MongoDBProvider.js";
import { ensureElementsUnique, ensureStringArray, isSubsetOf } from "./utils/CoreUtils.js";

export type ObjectIdDescriber = ObjectId;

export interface EntityIdEquals { id: ObjectIdDescriber; }
export interface EntitySubOf { subof: ObjectIdDescriber; }
export type EntityRestrictorObject = EntityIdEquals | EntitySubOf;
export type EntityRestrictor = EntityRestrictorObject | '*';

export interface RequesterCondtion { requester: EntityRestrictor; }
export interface ResourceIdCondtion { resourceId: ObjectIdDescriber; }
export interface AccessCondition { access: string | string[]; }
export interface OrCondition { or: PolicyCheckCondition[]; }
export interface AndCondition { and: PolicyCheckCondition[]; }
export type PolicyCheckCondition = RequesterCondtion | ResourceIdCondtion | AccessCondition | OrCondition | AndCondition;

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

export function compileEntityRestrictor(origin: EntityRestrictorObject): (entity: ObjectId) => Promise<boolean> {
  const terms: ((entity: ObjectId) => Promise<boolean> | boolean)[] = [];
  for (let k in origin) {
    let t: (entity: ObjectId) => Promise<boolean> | boolean;
    switch (k) {
      case 'id':
        t = ObjectId.prototype.equals.bind(new ObjectId((<EntityIdEquals>origin).id));
        break;
      case 'subof': {
        const v = new ObjectId((<EntityIdEquals>origin).id);
        t = async (entity: ObjectId) => {
          if (v.equals(entity)) return true;
          const iterator = await ascertainAncestors(entity);
          for (let i of iterator)
            if (i.equals(entity)) return true;
          return false;
        };
        break;
      }
      default:
        throw new Error('Unknown EntityRestictor definition');
    }
    terms.push(t);
  }
  return LogicalAnd(terms);
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
        t = (context: CheckPermContext) => v.equals(context.resource);
        break;
      }
      case 'access': {
        const allowedAccess = [...ensureElementsUnique(ensureStringArray((<AccessCondition>origin).access))];
        t = (context: CheckPermContext) => isSubsetOf(context.access, allowedAccess);
        break;
      }
      case 'or':
        t = LogicalOr((<OrCondition>origin).or.map(compileCheck));
        break;
      case 'and':
        t = LogicalAnd((<AndCondition>origin).and.map(compileCheck));
        break;
      default:
        throw new Error('Unknown PolicyCheck definition');
    }
    terms.push(t);
  }
  if (terms.length === 1)
    return terms[0];
  return LogicalAnd(terms);
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

  constructor(id: ObjectId, { selector, contents = [], priority = 0, ...otherProps }: { _id?: never, selector?: PolicySelector, contents?: Iterable<PolicyContent>, priority?: number, [k: string]: any } = {}) {
    super(id, otherProps);
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

export const { retrieve: retrievePolicy, modify: modifyPolicy, create: createPolicy, delete: deletePolicy, find: findPolicies } = createExtendable(getPolicyCollection, ['owner'], Policy);