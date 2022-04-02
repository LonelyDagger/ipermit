import { Collection, ObjectId } from "mongodb";
import { createExtendable, Datum, globalDefaultProivder } from "./MongoDBProvider.js";

function getResourceCollection(): Collection { return <Collection>globalDefaultProivder.resourceCollection; }

export class Resource extends Datum {
  owner?: ObjectId;
  type: string;
  boundPolicies?: ObjectId[];

  constructor(id: ObjectId, { _id, owner, type, boundPolicies, ...otherProps }: { owner?: ObjectId, type?: string, boundPolicies?: ObjectId[], [k: string]: any } = {}) {
    super(id, otherProps);
    this.owner = owner;
    this.type = type ?? 'default';
    this.boundPolicies = boundPolicies;
  }
}

export const { retrieve: retrieveResource, modify: modifyResource, create: createResource, delete: deleteResource, find: findResources } = createExtendable(getResourceCollection, ['owner'], Resource);