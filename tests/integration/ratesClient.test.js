const http = require("node:http");
const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");
const { RatesClient } = require("../../src/clients/ratesClient");

const AUTH = ["Authorization", "Bearer test-token"];

let ratesServer; // our puppet rates API
let db;

// Start a local HTTP server on a random free port and hand back its URL.
// `handler` decides how the puppet behaves: answer nicely, or hang.
function startRatesServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

// Boots the real app wired to a RatesClient that points at our puppet server.
function makeApp(ratesUrl, timeoutMs) {
  db = createDb(":memory:");
  return createApp({
    db,
    apiToken: "test-token",
    ratesClient: new RatesClient({ url: ratesUrl, timeoutMs }),
  });
}

afterEach(async () => {
  db?.close();
  if (ratesServer) {
    ratesServer.closeAllConnections?.(); // kill hanging sockets so close() can finish
    await new Promise((resolve) => ratesServer.close(resolve));
    ratesServer = null;
  }
});

describe("RatesClient <-> a real local HTTP server", () => {
  test("a report converts amounts using rates fetched over a real HTTP call", async () => {
    const { server, url } = await startRatesServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rates: { USD: 1, EUR: 0.5 } }));
    });
    ratesServer = server;

    const app = makeApp(url, 1000);

    // Seed one user with one expense through the real API.
    const user = await request(app)
      .post("/users")
      .set(...AUTH)
      .send({ name: "Ada", email: "ada@example.com" });
    await request(app)
      .post(`/users/${user.body.id}/expenses`)
      .set(...AUTH)
      .send({ amountCents: 1000, category: "food", date: "2026-07-03" });

    const report = await request(app)
      .get(`/users/${user.body.id}/reports/monthly?month=2026-07&currency=EUR`)
      .set(...AUTH);

    // 1000 cents * 0.5 = 500 — the rate really travelled over a socket to get here.
    expect(report.status).toBe(200);
    expect(report.body.totalCents).toBe(500);
    expect(report.body.categories).toEqual([{ category: "food", totalCents: 500 }]);
  });

  test("a rates server that hangs longer than timeoutMs yields a real 502", async () => {
    const { server, url } = await startRatesServer(() => {
      // Deliberately do nothing: accept the connection, never respond.
      // The client's AbortSignal.timeout is the only thing that can save it.
    });
    ratesServer = server;

    const app = makeApp(url, 200); // short real timeout: 200ms

    const user = await request(app)
      .post("/users")
      .set(...AUTH)
      .send({ name: "Ada", email: "ada@example.com" });

    const report = await request(app)
      .get(`/users/${user.body.id}/reports/monthly?month=2026-07&currency=EUR`)
      .set(...AUTH);

    expect(report.status).toBe(502);
    expect(report.body.error.code).toBe("UPSTREAM_ERROR");
  });
});
