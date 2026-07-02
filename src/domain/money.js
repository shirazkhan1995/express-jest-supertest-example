const { ValidationError } = require("./errors");

// All amounts are stored internally as integer USD cents.
// `rates` maps a currency code to its value per 1 USD, e.g. { USD: 1, EUR: 0.92 }.

function convertCents(amountCents, toCurrency, rates) {
  if (!Number.isInteger(amountCents)) {
    throw new TypeError("amountCents must be an integer");
  }
  if (toCurrency === "USD") return amountCents;
  const rate = rates ? rates[toCurrency] : undefined;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new ValidationError(`Unsupported currency: ${toCurrency}`);
  }
  return Math.round(amountCents * rate);
}

function formatCents(amountCents) {
  if (!Number.isInteger(amountCents)) {
    throw new TypeError("amountCents must be an integer");
  }
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  const units = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${units}.${cents}`;
}

module.exports = { convertCents, formatCents };
