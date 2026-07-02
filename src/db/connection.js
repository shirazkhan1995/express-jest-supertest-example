const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { migrate } = require("./migrate");

function createDb(file) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

module.exports = { createDb };
