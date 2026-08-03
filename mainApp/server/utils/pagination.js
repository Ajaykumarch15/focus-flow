// IES-P1-18 / IES-P2-04: shared keyset (cursor) pagination.
//
// Keeps list endpoints bounded and ordering stable:
//   - `limit`  caps the page size (default 50, max 100).
//   - `cursor` is an opaque base64url token encoding { t, id } — the last item's
//     primary timestamp and _id — so the next page is fetched with
//     (t < cursor.t) OR (t == cursor.t AND _id < cursor.id), which matches the
//     (t: -1, _id: -1) sort exactly.

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePageSize(value) {
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, MAX_PAGE_SIZE);
  return DEFAULT_PAGE_SIZE;
}

function encodeCursor(t, id) {
  return Buffer.from(JSON.stringify({ t, id })).toString('base64url');
}

// Returns null when no cursor was provided, { t, id } when valid, or { error: true }.
function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed.t === 'number' && typeof parsed.id === 'string') return parsed;
  } catch { /* fallthrough */ }
  return { error: true };
}

// Mongo filter selecting docs strictly after (t, id) in a (t: -1, _id: -1) sort.
function cursorFilter(tField, cursor) {
  if (!cursor) return {};
  return {
    $or: [
      { [tField]: { $lt: cursor.t } },
      { [tField]: cursor.t, _id: { $lt: cursor.id } },
    ],
  };
}

// Runs the query and shapes the response as { items, hasMore, nextCursor }.
async function paginateCursor({ model, filter, tField, limit, cursor, select, populate }) {
  let query = model.find({ ...filter, ...cursorFilter(tField, cursor) })
    .sort({ [tField]: -1, _id: -1 })
    .limit(limit + 1);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);
  const docs = await query;
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last
      ? encodeCursor(last[tField] instanceof Date ? last[tField].getTime() : Number(last[tField]), last._id.toString())
      : null,
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePageSize,
  encodeCursor,
  decodeCursor,
  cursorFilter,
  paginateCursor,
};
