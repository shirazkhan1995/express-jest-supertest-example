const express = require("express");
const config = require("./config");
const { createDb } = require("./db/connection");
const { RatesClient } = require("./clients/ratesClient");
const { authenticate } = require("./middleware/auth");
const { notFoundHandler, errorHandler } = require("./middleware/errors");
const { createUsersRepo } = require("./repositories/usersRepo");
const { createExpensesRepo } = require("./repositories/expensesRepo");
const { createBudgetsRepo } = require("./repositories/budgetsRepo");
const { createUsersService } = require("./services/usersService");
const { createExpensesService } = require("./services/expensesService");
const { createBudgetsService } = require("./services/budgetsService");
const { createReportsService } = require("./services/reportsService");
const { createUsersRouter } = require("./routes/users");
const { createUserExpensesRouter, createExpensesRouter } = require("./routes/expenses");
const { createBudgetsRouter } = require("./routes/budgets");
const { createReportsRouter } = require("./routes/reports");

/**
 * Application factory. Every out-of-process dependency can be injected,
 * which is the seam your tests should use:
 *
 *   createApp({ db: createDb(":memory:"), apiToken: "test-token" })
 */
function createApp({
  db = createDb(config.dbFile),
  ratesClient = new RatesClient({
    url: config.ratesUrl,
    timeoutMs: config.ratesTimeoutMs,
    cacheTtlMs: config.ratesCacheTtlMs,
  }),
  apiToken = config.apiToken,
  now = () => new Date(),
} = {}) {
  const usersRepo = createUsersRepo(db);
  const expensesRepo = createExpensesRepo(db);
  const budgetsRepo = createBudgetsRepo(db);

  const usersService = createUsersService({ usersRepo });
  const expensesService = createExpensesService({ usersRepo, expensesRepo });
  const budgetsService = createBudgetsService({ usersRepo, budgetsRepo, expensesRepo, now });
  const reportsService = createReportsService({ usersRepo, expensesRepo, budgetsRepo, ratesClient });

  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use(authenticate(apiToken));

  app.use("/users/:userId/expenses", createUserExpensesRouter({ expensesService }));
  app.use("/users/:userId/budgets", createBudgetsRouter({ budgetsService }));
  app.use("/users/:userId/reports", createReportsRouter({ reportsService }));
  app.use("/users", createUsersRouter({ usersService }));
  app.use("/expenses", createExpensesRouter({ expensesService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
