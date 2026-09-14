/**
 * Normalized representation of a Stellar transaction.
 *
 * The parser converts an XDR envelope (classic or Soroban) into this shape so
 * that the policy engine and risk engine never need to touch XDR directly.
 * Amounts are decimal strings exactly as Stellar represents them (7 decimals),
 * except Soroban token transfers which are raw integer strings in the token's
 * own decimals.
 */
export type AssetRef =
  | { type: "native"; code: "XLM" }
  | { type: "credit_alphanum4" | "credit_alphanum12"; code: string; issuer: string }
  | { type: "contract"; contractId: string };

export function assetKey(asset: AssetRef): string {
  switch (asset.type) {
    case "native":
      return "native";
    case "credit_alphanum4":
    case "credit_alphanum12":
      return `${asset.code}:${asset.issuer}`;
    case "contract":
      return `contract:${asset.contractId}`;
  }
}

export interface PaymentLike {
  destination: string;
  asset: AssetRef;
  amount: string;
}

export interface ParsedOperation {
  index: number;
  /** Stellar operation type, e.g. "payment", "invokeHostFunction". */
  type: string;
  /** Operation-level source account if it differs from the transaction source. */
  source?: string;
  /** Value transfers implied by the operation, if any. */
  transfers: PaymentLike[];
  /** Soroban-specific details when the op is an invokeHostFunction. */
  contract?: {
    contractId?: string;
    functionName?: string;
    hostFunctionType: "invoke_contract" | "create_contract" | "upload_wasm";
  };
}

export interface ParsedMemo {
  type: "none" | "text" | "id" | "hash" | "return";
  value?: string;
}

export interface ParsedTransaction {
  networkPassphrase: string;
  /** Hex hash of the (inner) transaction. */
  hash: string;
  /** Source account of the inner transaction. */
  source: string;
  /** Total fee in stroops (as string). */
  fee: string;
  sequence: string;
  memo: ParsedMemo;
  timeBounds?: { minTime: string; maxTime: string };
  operations: ParsedOperation[];
  feeBump?: { feeSource: string; fee: string };
  /** True if any operation is a Soroban host-function invocation. */
  isSoroban: boolean;
  /** Number of signatures already attached to the envelope. */
  signatureCount: number;
}
