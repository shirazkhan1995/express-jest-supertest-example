const { Router } = require("express");

// Mounted at /users/:userId/expenses
function createUserExpensesRouter({ expensesService }) {
  const router = new Router({ mergeParams: true });

  router.post("/", async (req, res) => {
    const expense = await expensesService.addExpense(req.params.userId, req.body);
    res.status(201).json(expense);
  });

  router.get("/", async (req, res) => {
    res.json(await expensesService.listExpenses(req.params.userId, req.query));
  });

  return router;
}

// Mounted at /expenses
function createExpensesRouter({ expensesService }) {
  const router = new Router();

  router.patch("/:id", async (req, res) => {
    res.json(await expensesService.updateExpense(req.params.id, req.body));
  });

  router.delete("/:id", async (req, res) => {
    await expensesService.deleteExpense(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createUserExpensesRouter, createExpensesRouter };
