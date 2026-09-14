/**
 * Error codes are stable identifiers that API consumers and SDKs can branch on.
 * Messages are human readable and may change between versions.
 */
export type TxGuardErrorCode =
  | "INVALID_XDR"
  | "UNSUPPORTED_ENVELOPE"
  | "INVALID_POLICY"
  | "SIMULATION_FAILED"
  | "RPC_UNAVAILABLE"
  | "INTERNAL";

export class TxGuardError extends Error {
  readonly code: TxGuardErrorCode;
  readonly details?: unknown;

  constructor(code: TxGuardErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "TxGuardError";
    this.code = code;
    this.details = details;
  }
}
