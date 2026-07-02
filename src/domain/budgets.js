const WARN_THRESHOLD = 0.8;

function budgetStatus(spentCents, limitCents) {
  if (!Number.isInteger(limitCents) || limitCents <= 0) {
    throw new RangeError("limitCents must be a positive integer");
  }
  if (!Number.isInteger(spentCents) || spentCents < 0) {
    throw new RangeError("spentCents must be a non-negative integer");
  }
  if (spentCents > limitCents) return "OVER";
  if (spentCents / limitCents > WARN_THRESHOLD) return "WARN";
  return "OK";
}

module.exports = { WARN_THRESHOLD, budgetStatus };
