const { validateBudget, validateCategory, parseId } = require("../domain/validate");
const { NotFoundError } = require("../domain/errors");
const { budgetStatus } = require("../domain/budgets");
const { monthRange } = require("../domain/reports");

function currentMonth(now) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function createBudgetsService({ usersRepo, budgetsRepo, expensesRepo, now = () => new Date() }) {
  function requireUser(idRaw) {
    const userId = parseId(idRaw, "userId");
    if (!usersRepo.findById(userId)) throw new NotFoundError("User", userId);
    return userId;
  }

  return {
    async setBudget(userIdRaw, categoryRaw, body) {
      const userId = requireUser(userIdRaw);
      const category = validateCategory(categoryRaw);
      const { monthlyLimitCents } = validateBudget(body);
      return budgetsRepo.upsert(userId, category, monthlyLimitCents);
    },

    async listBudgets(userIdRaw) {
      const userId = requireUser(userIdRaw);
      const month = currentMonth(now());
      const { from, to } = monthRange(month);
      const spentByCategory = new Map(
        expensesRepo
          .sumByCategoryBetween(userId, from, to)
          .map(({ category, totalCents }) => [category, totalCents])
      );
      return budgetsRepo.listForUser(userId).map((budget) => {
        const spentCents = spentByCategory.get(budget.category) || 0;
        return {
          category: budget.category,
          monthlyLimitCents: budget.monthlyLimitCents,
          month,
          spentCents,
          status: budgetStatus(spentCents, budget.monthlyLimitCents),
        };
      });
    },
  };
}

module.exports = { createBudgetsService };
