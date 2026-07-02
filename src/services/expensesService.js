const {
  validateNewExpense,
  validateExpensePatch,
  validateCategory,
  isValidDate,
  parseId,
  parsePagination,
} = require("../domain/validate");
const { NotFoundError, ValidationError, ImmutableFieldError } = require("../domain/errors");

function parseListFilters(query) {
  const filters = {};
  if (query.category !== undefined) {
    filters.category = validateCategory(query.category);
  }
  for (const key of ["from", "to"]) {
    if (query[key] !== undefined) {
      if (!isValidDate(query[key])) {
        throw new ValidationError(`${key} must be a valid calendar date in YYYY-MM-DD format`);
      }
      filters[key] = query[key];
    }
  }
  return filters;
}

function createExpensesService({ usersRepo, expensesRepo }) {
  function requireUser(idRaw) {
    const userId = parseId(idRaw, "userId");
    if (!usersRepo.findById(userId)) throw new NotFoundError("User", userId);
    return userId;
  }

  return {
    async addExpense(userIdRaw, body) {
      const userId = requireUser(userIdRaw);
      const data = validateNewExpense(body);
      return expensesRepo.create({ userId, ...data });
    },

    async listExpenses(userIdRaw, query) {
      const userId = requireUser(userIdRaw);
      const filters = parseListFilters(query);
      const { page, pageSize, limit, offset } = parsePagination(query);
      return {
        items: expensesRepo.listForUser(userId, filters, { limit, offset }),
        page,
        pageSize,
        total: expensesRepo.countForUser(userId, filters),
      };
    },

    async updateExpense(idRaw, body) {
      const id = parseId(idRaw, "expenseId");
      const { updates, immutable } = validateExpensePatch(body);
      if (immutable.length > 0) throw new ImmutableFieldError(immutable);
      const updated = expensesRepo.update(id, updates);
      if (!updated) throw new NotFoundError("Expense", id);
      return updated;
    },

    async deleteExpense(idRaw) {
      const id = parseId(idRaw, "expenseId");
      if (!expensesRepo.remove(id)) throw new NotFoundError("Expense", id);
    },
  };
}

module.exports = { createExpensesService };
