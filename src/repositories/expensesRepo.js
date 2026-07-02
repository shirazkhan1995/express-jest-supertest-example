function rowToExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    category: row.category,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
  };
}

function buildFilter(userId, { category, from, to } = {}) {
  const clauses = ["user_id = ?"];
  const params = [userId];
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (from) {
    clauses.push("date >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("date <= ?");
    params.push(to);
  }
  return { where: clauses.join(" AND "), params };
}

function createExpensesRepo(db) {
  const insertStmt = db.prepare(
    "INSERT INTO expenses (user_id, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?)"
  );
  const byIdStmt = db.prepare("SELECT * FROM expenses WHERE id = ?");
  const updateStmt = db.prepare("UPDATE expenses SET category = ?, description = ? WHERE id = ?");
  const deleteStmt = db.prepare("DELETE FROM expenses WHERE id = ?");
  const sumByCategoryStmt = db.prepare(
    `SELECT category, SUM(amount_cents) AS total_cents
     FROM expenses
     WHERE user_id = ? AND date >= ? AND date < ?
     GROUP BY category
     ORDER BY category`
  );

  return {
    create({ userId, amountCents, category, description, date }) {
      const info = insertStmt.run(userId, amountCents, category, description, date);
      return rowToExpense(byIdStmt.get(info.lastInsertRowid));
    },
    findById(id) {
      return rowToExpense(byIdStmt.get(id));
    },
    listForUser(userId, filters, { limit, offset }) {
      const { where, params } = buildFilter(userId, filters);
      const rows = db
        .prepare(`SELECT * FROM expenses WHERE ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return rows.map(rowToExpense);
    },
    countForUser(userId, filters) {
      const { where, params } = buildFilter(userId, filters);
      return db.prepare(`SELECT COUNT(*) AS n FROM expenses WHERE ${where}`).get(...params).n;
    },
    sumByCategoryBetween(userId, from, to) {
      return sumByCategoryStmt
        .all(userId, from, to)
        .map((row) => ({ category: row.category, totalCents: row.total_cents }));
    },
    update(id, { category, description }) {
      const current = byIdStmt.get(id);
      if (!current) return null;
      updateStmt.run(category ?? current.category, description ?? current.description, id);
      return rowToExpense(byIdStmt.get(id));
    },
    remove(id) {
      return deleteStmt.run(id).changes > 0;
    },
  };
}

module.exports = { createExpensesRepo };
