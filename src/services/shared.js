import mongoose from 'mongoose';

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function notFound(what) {
  return new ApiError(404, `${what} not found`);
}

export function conflict(message) {
  return new ApiError(409, message);
}

export function forbidden() {
  return new ApiError(403, 'Forbidden');
}

export function isId(value) {
  return mongoose.isValidObjectId(value);
}

export function assertId(id, what) {
  if (!isId(id)) throw notFound(what);
}

export function validate(schema, input) {
  const parsed = schema.safeParse(input ?? {});
  if (parsed.success) return parsed.data;

  throw new ApiError(
    400,
    'Invalid request',
    parsed.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    })),
  );
}

export function parseListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? '20', 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function searchFilter(search, fields) {
  const term = String(search ?? '').trim();
  if (!term) return {};

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

export function toId(value) {
  if (value === null || value === undefined) return null;
  return String(value._id ?? value.id ?? value);
}

export function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

export function plain(document) {
  return typeof document.toObject === 'function' ? document.toObject() : document;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export async function listResult(model, filter, { page, limit, skip }, serialize, sort = { createdAt: -1 }) {
  const [documents, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    model.countDocuments(filter),
  ]);

  return { items: documents.map(serialize), total, page, limit };
}

function monthPrefix(prefix, now) {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}-${now.getUTCFullYear()}-${month}`;
}

export async function nextNumber(model, field, prefix, now = new Date()) {
  const base = monthPrefix(prefix, now);
  const last = await model.findOne({ [field]: new RegExp(`^${base}-\\d{4}$`) }).sort({ [field]: -1 }).lean();
  const sequence = last ? Number.parseInt(String(last[field]).slice(-4), 10) + 1 : 1;
  return `${base}-${String(sequence).padStart(4, '0')}`;
}

// ponytail: one retry is the contracted ceiling. Concurrent inserts beyond that fail loudly
// instead of silently reusing a number.
export async function createNumbered(model, field, prefix, build, now = new Date()) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const number = await nextNumber(model, field, prefix, now);
    try {
      return await model.create(build(number));
    } catch (error) {
      if (attempt === 1 || error?.code !== 11000) throw error;
    }
  }

  throw new Error('Number generation failed');
}
