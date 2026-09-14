import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { TxGuardError } from "@stellar-txguard/core";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

export interface ErrorBody {
  error: { code: string; message: string; requestId: string; details?: unknown };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const CORE_STATUS: Record<TxGuardError["code"], number> = {
  INVALID_XDR: 400,
  UNSUPPORTED_ENVELOPE: 400,
  INVALID_POLICY: 400,
  SIMULATION_FAILED: 422,
  RPC_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export function errorHandler(
  err: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = req.id;
  let status = 500;
  let code = "INTERNAL";
  let message = "internal server error";
  let details: unknown;

  if (err instanceof HttpError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof TxGuardError) {
    status = CORE_STATUS[err.code];
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (hasZodFastifySchemaValidationErrors(err)) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "request failed validation";
    details = err.validation.map((v) => ({ path: v.instancePath, message: v.message }));
  } else if (isResponseSerializationError(err)) {
    status = 500;
    code = "RESPONSE_SERIALIZATION";
    message = "response did not match schema";
  } else if ("statusCode" in err && typeof err.statusCode === "number" && err.statusCode < 500) {
    status = err.statusCode;
    code = ("code" in err && typeof err.code === "string" && err.code) || "BAD_REQUEST";
    message = err.message;
  }

  if (status >= 500) req.log.error({ err, requestId }, "request failed");
  else req.log.info({ code, requestId }, "request rejected");

  const body: ErrorBody = {
    error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
  };
  void reply.status(status).send(body);
}
