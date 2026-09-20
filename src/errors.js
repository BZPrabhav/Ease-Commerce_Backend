class AppError extends Error {
  constructor(code, message, statusCode = 500, details = {}, cause = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.cause = cause;
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super('NOT_FOUND', message, 404, details);
  }
}

class CourierValidationError extends AppError {
  constructor(message, details = {}) {
    super('INVALID_COURIER_PARTNER', message, 400, details);
  }
}

class CourierApiError extends AppError {
  constructor(message, details = {}, statusCode = 502, code = 'COURIER_API_ERROR') {
    super(code, message, statusCode, details);
  }
}

function normalizeError(err, requestId = 'unknown') {
  const error = err instanceof AppError ? err : new AppError('INTERNAL_SERVER_ERROR', 'Unexpected server error', 500, {}, err);

  return {
    success: false,
    request_id: requestId,
    error: {
      code: error.code,
      message: error.message,
      status: error.statusCode,
      details: error.details || {}
    }
  };
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  CourierValidationError,
  CourierApiError,
  normalizeError
};
