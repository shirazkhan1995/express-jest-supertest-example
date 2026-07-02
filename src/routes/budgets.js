const { Router } = require("express");

// Mounted at /users/:userId/budgets
function createBudgetsRouter({ budgetsService }) {
  const router = new Router({ mergeParams: true });

  router.put("/:category", async (req, res) => {
    res.json(await budgetsService.setBudget(req.params.userId, req.params.category, req.body));
  });

  router.get("/", async (req, res) => {
    res.json(await budgetsService.listBudgets(req.params.userId));
  });

  return router;
}

module.exports = { createBudgetsRouter };
