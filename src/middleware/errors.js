const { AppError, ValidationError, NotFoundError } = require("../domain/errors");

function notFoundHandler(req, res, next) {
  next(new NotFoundError("Route", `${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // express.json() throws this for malformed JSON bodies
  if (err.type === "entity.parse.failed") {
    err = new ValidationError("Request body is not valid JSON");
  }
  if (err instanceof AppError) {
    const payload = { code: err.code, message: err.message };
    if (err.details !== undefined) payload.details = err.details;
    return res.status(err.status).json({ error: payload });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}

module.exports = { notFoundHandler, errorHandler };
