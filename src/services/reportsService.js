const { validateMonth, validateCurrency, parseId } = require("../domain/validate");
const { NotFoundError } = require("../domain/errors");
const { monthRange, buildMonthlyReport } = require("../domain/reports");

function createReportsService({ usersRepo, expensesRepo, budgetsRepo, ratesClient }) {
  return {
    async monthlyReport(userIdRaw, query) {
      const userId = parseId(userIdRaw, "userId");
      if (!usersRepo.findById(userId)) throw new NotFoundError("User", userId);

      const month = validateMonth(query.month);
      const currency = query.currency === undefined ? "USD" : validateCurrency(query.currency);

      const { from, to } = monthRange(month);
      const categoryTotals = expensesRepo.sumByCategoryBetween(userId, from, to);
      const budgets = budgetsRepo.listForUser(userId);
      const rates = currency === "USD" ? { USD: 1 } : await ratesClient.getRates();

      return buildMonthlyReport({ month, currency, categoryTotals, budgets, rates });
    },
  };
}

module.exports = { createReportsService };
