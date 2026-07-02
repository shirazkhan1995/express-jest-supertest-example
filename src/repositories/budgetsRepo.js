function rowToBudget(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    category: row.category,
    monthlyLimitCents: row.monthly_limit_cents,
  };
}

function createBudgetsRepo(db) {
  const upsertStmt = db.prepare(
    `INSERT INTO budgets (user_id, category, monthly_limit_cents)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit_cents = excluded.monthly_limit_cents`
  );
  const getStmt = db.prepare("SELECT * FROM budgets WHERE user_id = ? AND category = ?");
  const listStmt = db.prepare("SELECT * FROM budgets WHERE user_id = ? ORDER BY category");

  return {
    upsert(userId, category, monthlyLimitCents) {
      upsertStmt.run(userId, category, monthlyLimitCents);
      return rowToBudget(getStmt.get(userId, category));
    },
    listForUser(userId) {
      return listStmt.all(userId).map(rowToBudget);
    },
  };
}

module.exports = { createBudgetsRepo };
