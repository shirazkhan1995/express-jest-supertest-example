const config = require("../config");
const { createDb } = require("./connection");

const db = createDb(config.dbFile);

const seed = db.transaction(() => {
  db.exec("DELETE FROM expenses; DELETE FROM budgets; DELETE FROM users;");

  const insertUser = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
  const insertExpense = db.prepare(
    "INSERT INTO expenses (user_id, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?)"
  );
  const insertBudget = db.prepare(
    "INSERT INTO budgets (user_id, category, monthly_limit_cents) VALUES (?, ?, ?)"
  );

  const ada = insertUser.run("Ada Lovelace", "ada@example.com").lastInsertRowid;
  const grace = insertUser.run("Grace Hopper", "grace@example.com").lastInsertRowid;

  const month = new Date().toISOString().slice(0, 7);
  insertExpense.run(ada, 4250, "food", "Groceries", `${month}-03`);
  insertExpense.run(ada, 1200, "transport", "Metro card", `${month}-05`);
  insertExpense.run(ada, 89900, "housing", "Rent", `${month}-01`);
  insertExpense.run(ada, 3600, "food", "Dinner out", `${month}-11`);
  insertExpense.run(grace, 15000, "entertainment", "Concert tickets", `${month}-08`);

  insertBudget.run(ada, "food", 10000);
  insertBudget.run(ada, "transport", 5000);
  insertBudget.run(grace, "entertainment", 12000);
});

seed();
console.log(`Seeded ${config.dbFile} with demo users, expenses, and budgets`);
db.close();
