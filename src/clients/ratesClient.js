const { UpstreamError } = require("../domain/errors");

class RatesClient {
  constructor({ url, timeoutMs = 3000, cacheTtlMs = 600000, fetchFn = globalThis.fetch } = {}) {
    if (!url) throw new TypeError("RatesClient requires a url");
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.cacheTtlMs = cacheTtlMs;
    this.fetchFn = fetchFn;
    this.cache = null;
  }

  async getRates() {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.rates;
    }
    let response;
    try {
      response = await this.fetchFn(this.url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new UpstreamError(`Exchange rate service unreachable: ${err.message}`);
    }
    if (!response.ok) {
      throw new UpstreamError(`Exchange rate service responded with status ${response.status}`);
    }
    const body = await response.json();
    const rates = body && body.rates;
    if (!rates || typeof rates !== "object" || rates.USD !== 1) {
      throw new UpstreamError("Exchange rate service returned an unexpected payload");
    }
    this.cache = { rates, expiresAt: Date.now() + this.cacheTtlMs };
    return rates;
  }
}

module.exports = { RatesClient };
