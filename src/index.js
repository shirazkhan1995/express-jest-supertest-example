const config = require("./config");
const { createApp } = require("./app");

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Expense Tracker API listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    app.locals.db.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
