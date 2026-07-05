const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDb } = require("../../src/db/connection");
const { createUsersRepo } = require("../../src/repositories/usersRepo");

let dir;
let dbFile;
let openDbs;

// A brand-new temp directory (and therefore a brand-new db file) per test.
// mkdtemp appends random characters, so parallel/repeated runs can never
// collide — this is what makes the test repeatable.
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "expense-tracker-test-"));
  dbFile = path.join(dir, "test.db");
  openDbs = [];
});

// Close every connection a test opened (even if it failed mid-way), then
// delete the temp directory. No stray files, no leaked handles.
afterEach(() => {
  for (const db of openDbs) {
    try {
      db.close();
    } catch {
      /* already closed by the test — fine */
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

// Tracked wrapper so afterEach can always clean up.
function openDb() {
  const db = createDb(dbFile);
  openDbs.push(db);
  return db;
}

describe("repositories <-> real SQLite file on disk", () => {
  test("data written through one connection survives close and reopen", () => {
    // Connection #1: write, then close — the storeroom door shuts.
    const db1 = openDb();
    const created = createUsersRepo(db1).create({
      name: "Farheen",
      email: "farheen@hotmail.com",
    });
    expect(created).toMatchObject({ id: expect.any(Number), name: "Farheen" });
    db1.close();

    // Connection #2: a completely fresh handle on the same file. If the row
    // comes back, the data genuinely lives on disk, not in connection memory.
    const db2 = openDb();
    const found = createUsersRepo(db2).findById(created.id);

    expect(found).toEqual(created);
  });

  test("migrate is idempotent: booting twice on the same file neither fails nor duplicates", () => {
    const db1 = openDb();
    createUsersRepo(db1).create({ name: "Ada", email: "ada@example.com" });
    db1.close();

    // createDb runs migrate() every time. Opening an already-migrated file
    // must not throw ("table already exists") and must not touch the data.
    const db2 = openDb();
    const repo = createUsersRepo(db2);

    expect(repo.count()).toBe(1);
    expect(repo.findByEmail("ada@example.com").name).toBe("Ada");
  });
});
