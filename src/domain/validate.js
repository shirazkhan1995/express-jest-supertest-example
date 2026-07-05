/**
 * Request validation/parsing helpers shared by the route services. Each `validate*`/`parse*`
 * function either returns a normalized value or throws {@link ValidationError} (400) — none of
 * them mutate their input.
 * @module domain/validate
 */

const { ValidationError } = require("./errors");

const CATEGORIES = ["food", "transport", "housing", "entertainment", "health", "other"];
const MAX_AMOUNT_CENTS = 100_000_000; // 1,000,000.00 USD
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * Checks whether a value is a real calendar date in `YYYY-MM-DD` format
 * (rejects e.g. `2026-02-30`, which is not a real day).
 * @param {*} value
 * @returns {boolean}
 */
function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * @param {*} body
 * @throws {ValidationError} if body is not a plain JSON object (null, array, or non-object)
 */
function requireBodyObject(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
}

/**
 * Validates a `POST /users` body.
 * @param {*} body - expected `{ name, email }`
 * @returns {{name: string, email: string}} name trimmed, email lowercased
 * @throws {ValidationError} with one entry per invalid field in `details`
 */
function validateNewUser(body) {
  requireBodyObject(body);
  const errors = [];
  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    errors.push({ field: "name", message: "name must be a string of at least 2 characters" });
  }
  if (typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
    errors.push({ field: "email", message: "email must be a valid email address" });
  }
  if (errors.length > 0) throw new ValidationError("Invalid user payload", errors);
  return { name: body.name.trim(), email: body.email.toLowerCase() };
}

/**
 * Validates a `POST /users/:id/expenses` body.
 * @param {*} body - expected `{ amountCents, category, description?, date }`
 * @returns {{amountCents: number, category: string, description: string, date: string}}
 *   `description` defaults to `""` when omitted
 * @throws {ValidationError} with one entry per invalid field in `details`
 */
function validateNewExpense(body) {
  requireBodyObject(body);
  const errors = [];
  if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
    errors.push({ field: "amountCents", message: "amountCents must be a positive integer" });
  } else if (body.amountCents > MAX_AMOUNT_CENTS) {
    errors.push({ field: "amountCents", message: `amountCents must not exceed ${MAX_AMOUNT_CENTS}` });
  }
  if (!CATEGORIES.includes(body.category)) {
    errors.push({ field: "category", message: `category must be one of: ${CATEGORIES.join(", ")}` });
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: "description",
        message: `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters`,
      });
    }
  }
  if (!isValidDate(body.date)) {
    errors.push({ field: "date", message: "date must be a valid calendar date in YYYY-MM-DD format" });
  }
  if (errors.length > 0) throw new ValidationError("Invalid expense payload", errors);
  return {
    amountCents: body.amountCents,
    category: body.category,
    description: body.description || "",
    date: body.date,
  };
}

const MUTABLE_EXPENSE_FIELDS = ["category", "description"];

/**
 * Validates a `PATCH /expenses/:id` body. Only `category` and `description` are mutable;
 * any other key present in `body` is reported back as `immutable` rather than applied.
 * @param {*} body
 * @returns {{updates: object, immutable: string[]}}
 * @throws {ValidationError} if `body` has no keys, or `category`/`description` are invalid
 */
function validateExpensePatch(body) {
  requireBodyObject(body);
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new ValidationError("Patch body must contain at least one field");
  }
  const immutable = keys.filter((key) => !MUTABLE_EXPENSE_FIELDS.includes(key));
  const errors = [];
  const updates = {};
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      errors.push({ field: "category", message: `category must be one of: ${CATEGORIES.join(", ")}` });
    } else {
      updates.category = body.category;
    }
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: "description",
        message: `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters`,
      });
    } else {
      updates.description = body.description;
    }
  }
  if (errors.length > 0) throw new ValidationError("Invalid expense patch", errors);
  return { updates, immutable };
}

/**
 * Validates a `PUT /users/:id/budgets/:category` body.
 * @param {*} body - expected `{ monthlyLimitCents }`
 * @returns {{monthlyLimitCents: number}}
 * @throws {ValidationError} if `monthlyLimitCents` is not a positive integer
 */
function validateBudget(body) {
  requireBodyObject(body);
  if (!Number.isInteger(body.monthlyLimitCents) || body.monthlyLimitCents <= 0) {
    throw new ValidationError("Invalid budget payload", [
      { field: "monthlyLimitCents", message: "monthlyLimitCents must be a positive integer" },
    ]);
  }
  return { monthlyLimitCents: body.monthlyLimitCents };
}

/**
 * @param {*} value
 * @returns {string} the value, unchanged
 * @throws {ValidationError} if value is not one of `CATEGORIES`
 */
function validateCategory(value) {
  if (!CATEGORIES.includes(value)) {
    throw new ValidationError(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return value;
}

/**
 * @param {*} value
 * @returns {string} the value, unchanged
 * @throws {ValidationError} if value is not a string in `YYYY-MM` format (01-12)
 */
function validateMonth(value) {
  if (typeof value !== "string" || !MONTH_RE.test(value)) {
    throw new ValidationError("month must be provided in YYYY-MM format");
  }
  return value;
}

/**
 * @param {*} value
 * @returns {string} the value, unchanged
 * @throws {ValidationError} if value is not a 3-letter uppercase ISO currency code
 */
function validateCurrency(value) {
  if (typeof value !== "string" || !CURRENCY_RE.test(value)) {
    throw new ValidationError("currency must be a 3-letter uppercase ISO code, e.g. EUR");
  }
  return value;
}

/**
 * Coerces a route param to a positive integer id.
 * @param {*} value
 * @param {string} [name="id"] - field name used in the error message
 * @returns {number}
 * @throws {ValidationError} if value does not coerce to a positive integer
 */
function parseId(value, name = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
  return id;
}

/**
 * Parses and validates `page`/`pageSize` query params.
 * @param {{page?: *, pageSize?: *}} query - defaults: page=1, pageSize={@link DEFAULT_PAGE_SIZE}
 * @returns {{page: number, pageSize: number, limit: number, offset: number}}
 * @throws {ValidationError} if page < 1, or pageSize is outside `[1, MAX_PAGE_SIZE]`
 */
function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("page must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ValidationError(`pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

module.exports = {
  CATEGORIES,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  isValidDate,
  validateNewUser,
  validateNewExpense,
  validateExpensePatch,
  validateBudget,
  validateCategory,
  validateMonth,
  validateCurrency,
  parseId,
  parsePagination,
};
