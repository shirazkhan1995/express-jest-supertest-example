class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: "VALIDATION_ERROR", details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Missing or invalid bearer token") {
    super(message, { status: 401, code: "UNAUTHORIZED" });
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} ${id} not found`, { status: 404, code: "NOT_FOUND" });
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, { status: 409, code: "CONFLICT" });
  }
}

class ImmutableFieldError extends AppError {
  constructor(fields) {
    super(`Fields cannot be updated: ${fields.join(", ")}`, {
      status: 422,
      code: "IMMUTABLE_FIELD",
      details: { fields },
    });
  }
}

class UpstreamError extends AppError {
  constructor(message = "Upstream service unavailable") {
    super(message, { status: 502, code: "UPSTREAM_ERROR" });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ImmutableFieldError,
  UpstreamError,
};
