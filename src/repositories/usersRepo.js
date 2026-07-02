function rowToUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

function createUsersRepo(db) {
  const insertStmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
  const byIdStmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const byEmailStmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const listStmt = db.prepare("SELECT * FROM users ORDER BY id LIMIT ? OFFSET ?");
  const countStmt = db.prepare("SELECT COUNT(*) AS n FROM users");
  const deleteStmt = db.prepare("DELETE FROM users WHERE id = ?");

  return {
    create({ name, email }) {
      const info = insertStmt.run(name, email);
      return rowToUser(byIdStmt.get(info.lastInsertRowid));
    },
    findById(id) {
      return rowToUser(byIdStmt.get(id));
    },
    findByEmail(email) {
      return rowToUser(byEmailStmt.get(email));
    },
    list({ limit, offset }) {
      return listStmt.all(limit, offset).map(rowToUser);
    },
    count() {
      return countStmt.get().n;
    },
    remove(id) {
      return deleteStmt.run(id).changes > 0;
    },
  };
}

module.exports = { createUsersRepo };
