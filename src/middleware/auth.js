const { UnauthorizedError } = require("../domain/errors");

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
