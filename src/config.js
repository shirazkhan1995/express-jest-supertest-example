module.exports = {
  port: parseInt(process.env.PORT || "4000", 10),
  apiToken: process.env.API_TOKEN || "dev-token",
  dbFile: process.env.DB_FILE || "data/expenses.db",
  ratesUrl: process.env.RATES_URL || "https://open.er-api.com/v6/latest/USD",
  ratesTimeoutMs: parseInt(process.env.RATES_TIMEOUT_MS || "3000", 10),
  ratesCacheTtlMs: parseInt(process.env.RATES_CACHE_TTL_MS || "600000", 10),
};
