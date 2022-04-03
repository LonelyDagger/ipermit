import { Collection, ObjectId } from "mongodb";
import { createExtendable, Datum, globalDefaultProivder } from "./MongoDBProvider.js";
import { ensureElementsUnique } from "./utils/CoreUtils.js";

function getResourceCollection(): Collection { return <Collection>globalDefaultProivder.resourceCollection; }

export class Resource extends Datum {
  owner?: ObjectId;
  type: string;
  boundPolicies?: ObjectId[];

  constructor(id: ObjectId, { owner, type = 'default', boundPolicies, ...otherProps }: { _id?: never, owner?: ObjectId, type?: string, boundPolicies?: Iterable<ObjectId>, [k: string]: any } = {}) {
    super(id, otherProps);
    this.owner = owner;
    this.type = type;
    this.boundPolicies = [...ensureElementsUnique(boundPolicies, (v) => v.toString())];
  }
}

export const { retrieve: retrieveResource, modify: modifyResource, create: createResource, delete: deleteResource, find: findResources } = createExtendable(getResourceCollection, ['owner', 'type', 'boundPolicies'], Resource);