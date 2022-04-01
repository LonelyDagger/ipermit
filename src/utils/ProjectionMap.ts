export default class ProjectionMap<K, V> extends Map<K, V>  {
  private keyProjector: (value: V) => K;
  public constructor(keyProjector: (value: V) => K, iterable?: Iterable<V>) {
    super();
    this.keyProjector = keyProjector;
    if (iterable)
      for (let i of iterable)
        this.addValue(i);
  }

  public addValue(value: V) {
    this.set(this.keyProjector(value), value);
    return this;
  }

  public addValues(values: Iterable<V>) {
    for (let v of values)
      this.addValue(v);
    return this;
  }

  public deleteValue(value: V) {
    return this.delete(this.keyProjector(value));
  }

  public hasValue(value: V) {
    return this.has(this.keyProjector(value));
  }
}