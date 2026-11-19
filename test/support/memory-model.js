import { Types } from 'mongoose';

function getPath(document, path) {
  return path.split('.').reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), document);
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((entry) => matches(document, entry));
    if (key === '$and') return expected.every((entry) => matches(document, entry));
    if (key === '$expr') {
      const evaluate = (expression) => {
        if (Array.isArray(expression)) return expression.map(evaluate);
        if (typeof expression === 'string' && expression.startsWith('$')) return getPath(document, expression.slice(1));
        if (expression && typeof expression === 'object') {
          if ('$add' in expression) return evaluate(expression.$add).reduce((sum, value) => sum + value, 0);
          if ('$gte' in expression) { const [left, right] = evaluate(expression.$gte); return left >= right; }
        }
        return expression;
      };
      return evaluate(expected);
    }

    const value = getPath(document, key);
    if (expected instanceof RegExp) return expected.test(String(value ?? ''));
    if (expected === null) return value === null || value === undefined;
    if (typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.map(String).includes(String(value));
      if ('$ne' in expected) return String(value) !== String(expected.$ne);
      if ('$exists' in expected) return (value !== undefined) === expected.$exists;
      if ('$gte' in expected) return value >= expected.$gte;
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
    async updateOne(filter = {}, update = {}) {
      const document = documents.find((candidate) => matches(candidate, filter));
      if (!document) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) Object.assign(document, structuredClone(update.$set));
      else Object.assign(document, structuredClone(update));
      document.updatedAt = new Date();
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async deleteOne(filter = {}) {
      const index = documents.findIndex((candidate) => matches(candidate, filter));
      if (index < 0) return { deletedCount: 0 };
      documents.splice(index, 1);
      return { deletedCount: 1 };
    },
    countDocuments(filter = {}) {
      return Promise.resolve(documents.filter((document) => matches(document, filter)).length);
    },
    findOneAndUpdate(filter = {}, update = {}, options = {}) {
      return query(() => {
        const document = documents.find((candidate) => matches(candidate, filter));
        if (!document) return null;
        const patch = {};
        if (update.$set) Object.assign(patch, structuredClone(update.$set));
        if (update.$inc) {
          for (const [path, delta] of Object.entries(update.$inc)) {
            const keys = path.split('.');
            let target = patch;
            for (let i = 0; i < keys.length - 1; i += 1) {
              const key = keys[i];
              if (target[key] === undefined) target[key] = structuredClone(document[key]);
              target = target[key];
            }
            const leaf = keys[keys.length - 1];
            target[leaf] = (target[leaf] ?? document[leaf] ?? 0) + delta;
          }
        }
        Object.assign(document, patch, { updatedAt: new Date() });
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
    vendorPoModel: createMemoryModel(),
    goodsReceiptModel: createMemoryModel(),
  };
}
