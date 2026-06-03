/**
 * Centralised error handling utility.
 *
 * - In production (NODE_ENV === 'production'): sanitises all errors into a
 *   generic message so that no stack traces, SQL fragments, or internal
 *   library details ever reach the client.
 * - In development: includes the error message / stack to aid local debugging.
 */

const isProduction = process.env.NODE_ENV === "production";

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: unknown,
        public code?: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export function createApiError(statusCode: number, message: string, details?: unknown, code?: string): ApiError {
    return new ApiError(statusCode, message, details, code);
}

interface SanitisedError {
    statusCode: number;
    message: string;
    details?: unknown;
    code?: string;
    stack?: string[];
}

export function sanitizeError(error: unknown): SanitisedError {
    if (error instanceof ApiError) {
        return {
            statusCode: error.statusCode,
            message: isProduction ? "An internal error occurred." : error.message,
            code: error.code,
            ...(isProduction ? {} : { details: error.details }),
            ...(isProduction ? {} : error.stack ? { stack: error.stack.split("\n") } : {}),
        };
    }

    if (error instanceof Error) {
        return {
            statusCode: 500,
            message: isProduction ? "An internal error occurred." : error.message,
            ...(!isProduction && error.stack ? { stack: error.stack.split("\n") } : {}),
        };
    }

    return {
        statusCode: 500,
        message: isProduction ? "An internal error occurred." : String(error),
    };
}

export function buildErrorResponse(error: unknown) {
    const result = sanitizeError(error);
    const body: Record<string, unknown> = { error: result.message };
    if (result.details !== undefined) body.details = result.details;
    if (result.code !== undefined) body.code = result.code;
    if (result.stack !== undefined) body.stack = result.stack;
    const status = result.statusCode;
    return { status, body } as { status: number; body: Record<string, unknown> };
}
