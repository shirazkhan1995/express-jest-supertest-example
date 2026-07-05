const { UnauthorizedError } = require("../domain/errors");

/**
 * Express middleware **factory** for bearer-token auth. Call it once with the expected token
 * to get back the actual middleware — it does not authenticate by itself.
 *
 * ```js
 * const middleware = authenticate("dev-token");
 * app.use(middleware);
 * ```
 *
 * Behavior:
 * - Reads `req.headers.authorization`, expected shape `"Bearer <token>"`.
 * - Splits the header on a single space: `scheme = parts[0]`, `token = parts[1]`.
 * - Succeeds (calls `next()` with **no** arguments) only if `scheme === "Bearer"` (exact case)
 *   AND `token` is a non-empty string AND `token === expectedToken` (strict `===`).
 * - On any failure, calls `next(err)` with a **new** `UnauthorizedError` instance
 *   (`err.status === 401`, `err.code === "UNAUTHORIZED"`, default message
 *   `"Missing or invalid bearer token"`) — it never throws synchronously and never
 *   touches `res` itself, so a downstream error-handling middleware must translate
 *   the error into an HTTP response.
 *
 * Failure cases worth covering in unit tests:
 * - No `authorization` header at all (`req.headers.authorization` undefined → treated as `""`).
 * - Header present but with the wrong scheme (`"Basic abc"`) or wrong case (`"bearer abc"`),
 *   since the scheme comparison is case-sensitive.
 * - Header with no space (`"Bearertoken"`) → `scheme` becomes the whole string, `token` is
 *   `undefined`.
 * - Header with a double space (`"Bearer  token"`) → splitting on a single space yields
 *   `token === ""` (falsy), so this is rejected even though a human would read it as valid.
 * - Header with the right scheme but a token that doesn't match `expectedToken`.
 * - Header with the right scheme and an empty token (`"Bearer "`).
 *
 * Success case: `"Bearer <expectedToken>"` exactly → `next` is called with zero arguments
 * (not `next(undefined)` semantically different in test assertions — check
 * `next.mock.calls[0]).toHaveLength(0)` if you need to be strict, or just that no
 * `UnauthorizedError` was passed).
 *
 * Testing notes:
 * - `res` is never read or written, so a plain `{}` (or even `undefined`) is a sufficient mock.
 * - `req` only needs `{ headers: { authorization: "..." } }`.
 * - `next` should be a spy (e.g. `jest.fn()`); assert on `next.mock.calls` rather than a return
 *   value, since the middleware itself returns `undefined`.
 * - Each failure constructs a fresh `UnauthorizedError`, so compare with
 *   `expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))` or check
 *   `.status`/`.code` on the call argument, not object identity.
 *
 * @param {string} expectedToken - the token that must match (e.g. `process.env.API_TOKEN`)
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 *   Express middleware that calls `next()` on success or `next(UnauthorizedError)` on failure.
 */
function authenticate(expectedToken) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token || token !== expectedToken) {
      return next(new UnauthorizedError());
    }
    next();
  };
}

module.exports = { authenticate };
