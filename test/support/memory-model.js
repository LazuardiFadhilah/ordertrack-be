import { Types } from 'mongoose';

function getPath(document, path) {
  return path.split('.').reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), document);
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((entry) => matches(document, entry));

    const value = getPath(document, key);
    if (expected instanceof RegExp) return expected.test(String(value ?? ''));
    if (expected === null) return value === null || value === undefined;
    if (typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.map(String).includes(String(value));
      if ('$ne' in expected) return String(value) !== String(expected.$ne);
      if ('$exists' in expected) return (value !== undefined) === expected.$exists;
      return false;
    }

    return String(value) === String(expected);
  });
}

function sorted(documents, sort) {
  if (!sort) return documents;
  const [field, direction] = Object.entries(sort)[0];
  return [...documents].sort((left, right) => {
    const a = getPath(left, field);
    const b = getPath(right, field);
    if (a === b) return 0;
    return (a < b ? -1 : 1) * direction;
  });
}

function query(exec) {
  const state = { sort: null, skip: 0, limit: Infinity };
  const api = {
    sort(spec) {
      state.sort = spec;
      return api;
    },
    skip(value) {
      state.skip = value;
      return api;
    },
    limit(value) {
      state.limit = value;
      return api;
    },
    select() {
      return api;
    },
    lean() {
      return api;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(exec(state)).then(onFulfilled, onRejected);
    },
  };
  return api;
}

export function createMemoryModel() {
  const documents = [];

  function select(filter, state) {
    const matched = sorted(documents.filter((document) => matches(document, filter)), state.sort);
    return matched.slice(state.skip, state.limit === Infinity ? undefined : state.skip + state.limit);
  }

  return {
    documents,
    async create(data) {
      const now = new Date();
      const document = { _id: new Types.ObjectId().toString(), ...structuredClone(data), createdAt: now, updatedAt: now };
      documents.push(document);
      return structuredClone(document);
    },
    find(filter = {}) {
      return query((state) => select(filter, state).map((document) => structuredClone(document)));
    },
    findOne(filter = {}) {
      return query((state) => {
        const [document] = select(filter, state);
        return document ? structuredClone(document) : null;
      });
    },
    findById(id) {
      return query(() => {
        const document = documents.find((candidate) => String(candidate._id) === String(id));
        return document ? structuredClone(document) : null;
      });
    },
    countDocuments(filter = {}) {
      return Promise.resolve(documents.filter((document) => matches(document, filter)).length);
    },
    findOneAndUpdate(filter = {}, update = {}, options = {}) {
      return query(() => {
        const document = documents.find((candidate) => matches(candidate, filter));
        if (!document) return null;
        Object.assign(document, structuredClone(update.$set ?? {}), { updatedAt: new Date() });
        return options.new === false ? null : structuredClone(document);
      });
    },
    async insertMany(entries) {
      const created = [];
      for (const entry of entries) created.push(await this.create(entry));
      return created;
    },
  };
}

export function createMemoryModels() {
  return {
    customerModel: createMemoryModel(),
    vendorModel: createMemoryModel(),
    quotationModel: createMemoryModel(),
    salesOrderModel: createMemoryModel(),
  };
}
