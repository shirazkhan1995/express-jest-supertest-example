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

function requireBodyObject(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
}

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

function validateBudget(body) {
  requireBodyObject(body);
  if (!Number.isInteger(body.monthlyLimitCents) || body.monthlyLimitCents <= 0) {
    throw new ValidationError("Invalid budget payload", [
      { field: "monthlyLimitCents", message: "monthlyLimitCents must be a positive integer" },
    ]);
  }
  return { monthlyLimitCents: body.monthlyLimitCents };
}

function validateCategory(value) {
  if (!CATEGORIES.includes(value)) {
    throw new ValidationError(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return value;
}

function validateMonth(value) {
  if (typeof value !== "string" || !MONTH_RE.test(value)) {
    throw new ValidationError("month must be provided in YYYY-MM format");
  }
  return value;
}

function validateCurrency(value) {
  if (typeof value !== "string" || !CURRENCY_RE.test(value)) {
    throw new ValidationError("currency must be a 3-letter uppercase ISO code, e.g. EUR");
  }
  return value;
}

function parseId(value, name = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
  return id;
}

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
