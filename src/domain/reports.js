const { convertCents } = require("./money");
const { budgetStatus } = require("./budgets");

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function buildMonthlyReport({ month, currency, categoryTotals, budgets, rates }) {
  const budgetByCategory = new Map(budgets.map((b) => [b.category, b]));
  const categories = categoryTotals.map(({ category, totalCents }) => {
    const entry = {
      category,
      totalCents: convertCents(totalCents, currency, rates),
    };
    const budget = budgetByCategory.get(category);
    if (budget) {
      entry.budget = {
        monthlyLimitCents: convertCents(budget.monthlyLimitCents, currency, rates),
        status: budgetStatus(totalCents, budget.monthlyLimitCents),
      };
    }
    return entry;
  });
  return {
    month,
    currency,
    totalCents: categories.reduce((sum, c) => sum + c.totalCents, 0),
    categories,
    overBudgetCategories: categories
      .filter((c) => c.budget && c.budget.status === "OVER")
      .map((c) => c.category),
  };
}

module.exports = { monthRange, buildMonthlyReport };
