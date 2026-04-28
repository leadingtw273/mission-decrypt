type StoreMap = Map<IDBValidKey, unknown>;

interface DatabaseRecord {
  stores: Map<string, StoreMap>;
}

const databases = new Map<string, DatabaseRecord>();

class StubRequest<T> {
  public result!: T;
  public error: DOMException | null = null;
  public onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null;
  public onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null;
  public onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;

  succeed(result: T) {
    this.result = result;
    queueMicrotask(() => {
      this.onsuccess?.call(this as unknown as IDBRequest<T>, new Event('success'));
    });
  }

  fail(message: string) {
    this.error = new DOMException(message);
    queueMicrotask(() => {
      this.onerror?.call(this as unknown as IDBRequest<T>, new Event('error'));
    });
  }
}

class StubObjectStore {
  constructor(private readonly store: StoreMap) {}

  get(key: IDBValidKey) {
    const request = new StubRequest<unknown>();
    request.succeed(this.store.get(key));
    return request as unknown as IDBRequest<unknown>;
  }

  put(value: unknown, key: IDBValidKey) {
    const request = new StubRequest<IDBValidKey>();
    this.store.set(key, structuredClone(value));
    request.succeed(key);
    return request as unknown as IDBRequest<IDBValidKey>;
  }

  delete(key: IDBValidKey) {
    const request = new StubRequest<undefined>();
    this.store.delete(key);
    request.succeed(undefined);
    return request as unknown as IDBRequest<undefined>;
  }
}

class StubTransaction {
  public oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  public onerror: ((this: IDBTransaction, ev: Event) => unknown) | null = null;

  constructor(private readonly stores: Map<string, StoreMap>) {
    queueMicrotask(() => {
      this.oncomplete?.call(this as unknown as IDBTransaction, new Event('complete'));
    });
  }

  objectStore(name: string) {
    const store = this.stores.get(name);
    if (!store) {
      throw new DOMException(`Object store not found: ${name}`);
    }
    return new StubObjectStore(store) as unknown as IDBObjectStore;
  }
}

class StubDatabase {
  public objectStoreNames: DOMStringList;

  constructor(
    private readonly record: DatabaseRecord,
    readonly name: string,
  ) {
    this.objectStoreNames = createDomStringList(this.record.stores);
  }

  createObjectStore(name: string) {
    if (!this.record.stores.has(name)) {
      this.record.stores.set(name, new Map());
      this.objectStoreNames = createDomStringList(this.record.stores);
    }
    return new StubObjectStore(this.record.stores.get(name)!) as unknown as IDBObjectStore;
  }

  transaction(_name: string) {
    return new StubTransaction(this.record.stores) as unknown as IDBTransaction;
  }

  close() {}
}

function createDomStringList(stores: Map<string, StoreMap>): DOMStringList {
  const names = Array.from(stores.keys());
  return {
    length: names.length,
    contains: (name: string) => names.includes(name),
    item: (index: number) => names[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      yield* names;
    },
  } as DOMStringList;
}

function ensureDatabase(name: string): DatabaseRecord {
  let record = databases.get(name);
  if (!record) {
    record = { stores: new Map() };
    databases.set(name, record);
  }
  return record;
}

function makeFactory(): IDBFactory {
  return {
    cmp(first: IDBValidKey, second: IDBValidKey) {
      if (first === second) return 0;
      return String(first) < String(second) ? -1 : 1;
    },
    async databases() {
      return Array.from(databases.keys()).map((name) => ({ name }));
    },
    deleteDatabase(name: string) {
      databases.delete(name);
      const request = new StubRequest<undefined>();
      request.succeed(undefined);
      return request as unknown as IDBOpenDBRequest;
    },
    open(name: string) {
      const request = new StubRequest<IDBDatabase>() as StubRequest<IDBDatabase> & IDBOpenDBRequest;
      const record = ensureDatabase(name);
      const database = new StubDatabase(record, name) as unknown as IDBDatabase;

      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.call(
          request,
          new Event('upgradeneeded') as IDBVersionChangeEvent,
        );
        request.onsuccess?.call(request, new Event('success'));
      });

      return request;
    },
  } as unknown as IDBFactory;
}

export function installIndexedDbStub() {
  if (typeof indexedDB !== 'undefined') {
    return;
  }

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: makeFactory(),
  });
}

export function resetIndexedDbStub() {
  databases.clear();
}
