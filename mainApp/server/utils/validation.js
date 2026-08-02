// IES-P0-16: zod validation middleware + shared schemas for body/params/query.
//
// Rejects NaN and malformed input before it reaches a route or the DB. Valid
// numeric coercion happens via z.coerce.number() (NaN never passes), dates via
// explicit validity checks, ObjectIds via the 24-hex regex, and oversized
// arrays/strings via size caps so nothing can bloat a document toward the
// Mongo 16 MB limit.

const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// Calendar date key YYYY-MM-DD that actually exists (rejects 2024-02-30).
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (expected YYYY-MM-DD)')
  .refine((d) => {
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
  }, 'Invalid calendar date');

// Epoch-ms number or any parseable date string (ISO 8601 / RFC 2822).
const dateInput = z.union([
  z.number().finite('Invalid timestamp'),
  z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
]);

// Numeric values from form bodies / query strings. z.coerce.number() turns
// "123" into 123 and "abc"/undefined into NaN, which z.number() always rejects.
const timestamp = z.coerce.number().finite('Invalid timestamp');

const intInRange = (min, max, label) =>
  z
    .coerce
    .number()
    .int(`${label} must be an integer`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

// Required string: reports `message` for BOTH a missing value (invalid_type)
// and an empty/whitespace-only value, so clients always see a clear error.
const requiredString = (max, label, message) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `${label} too long (max ${max})`);

const email = requiredString(255, 'email', 'Email is required').pipe(z.email('Invalid email'));

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toValidationError(zodError) {
  const message = zodError.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
  return httpError(400, 'VALIDATION_ERROR', message);
}

/**
 * Express middleware that validates (and coerces) request body/params/query
 * with zod. On failure it forwards a structured 400 to the error handler.
 *
 *   router.post('/', validate(createSchema), handler)
 *   router.get('/:id', validate(null, { params: paramsSchema }), handler)
 *   router.patch('/:id', validate(patchSchema, { params: paramsSchema }), handler)
 */
function validate(bodySchema, { params, query } = {}) {
  return (req, _res, next) => {
    if (bodySchema) {
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return next(toValidationError(parsed.error));
      req.body = parsed.data;
    }
    if (params) {
      const parsed = params.safeParse(req.params);
      if (!parsed.success) return next(toValidationError(parsed.error));
      req.params = parsed.data;
    }
    if (query) {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) return next(toValidationError(parsed.error));
      req.query = parsed.data;
    }
    next();
  };
}

module.exports = {
  z,
  objectId,
  dateKey,
  dateInput,
  timestamp,
  intInRange,
  requiredString,
  email,
  validate,
  httpError,
  toValidationError,
};
