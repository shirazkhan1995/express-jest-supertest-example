const { Router } = require("express");

// Mounted at /users/:userId/reports
function createReportsRouter({ reportsService }) {
  const router = new Router({ mergeParams: true });

  router.get("/monthly", async (req, res) => {
    res.json(await reportsService.monthlyReport(req.params.userId, req.query));
  });

  return router;
}

module.exports = { createReportsRouter };
