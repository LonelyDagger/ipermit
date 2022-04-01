export type ObjectIdDescriber = string;

export interface EntityIdEquals {
  id: ObjectIdDescriber;
}
export interface EntitySubOf {
  subof: ObjectIdDescriber;
}
export type EntityRestrictor = EntityIdEquals | EntitySubOf;

export interface RequesterCondtion {
  requester: EntityRestrictor;
}
export interface ResourceIdCondtion {
  resourceId: ObjectIdDescriber;
}
export interface AccessCondition {
  access: string | string[];
}
export interface OrCondition {
  or: PolicyCheckCondition[];
}
export interface AndCondition {
  and: PolicyCheckCondition[];
}
export type PolicyCheckCondition = RequesterCondtion | ResourceIdCondtion | AccessCondition | OrCondition | AndCondition;

export type PolicyCheck = PolicyCheckCondition;
export type PolicyReact = boolean | undefined;

export interface PolicySelector {
  resourceOwner?: EntityRestrictor;
  resourceType?: string;
}
export interface PolicyContent {
  check: PolicyCheck;
  react: PolicyReact;
}

export interface Policy {
  selector?: PolicySelector;
  contents: PolicyContent[];
  priority?: number;
}