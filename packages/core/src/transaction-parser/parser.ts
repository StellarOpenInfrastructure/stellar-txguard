import type { Asset, Memo, Operation, Transaction } from "@stellar/stellar-sdk";
import {
  Address,
  FeeBumpTransaction,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

type OperationRecord = Transaction["operations"][number];
import { TxGuardError } from "../errors.js";
import type {
  AssetRef,
  ParsedMemo,
  ParsedOperation,
  ParsedTransaction,
  PaymentLike,
} from "./types.js";

function toAssetRef(asset: Asset): AssetRef {
  if (asset.isNative()) return { type: "native", code: "XLM" };
  const type =
    asset.getAssetType() === "credit_alphanum4" ? "credit_alphanum4" : "credit_alphanum12";
  const issuer = asset.getIssuer();
  if (!issuer) throw new TxGuardError("UNSUPPORTED_ENVELOPE", "issued asset without issuer");
  return { type, code: asset.getCode(), issuer };
}

/** Strip insignificant trailing zeros ("10.0000000" → "10", "1.50" → "1.5"). */
export function normalizeAmount(amount: string): string {
  if (!amount.includes(".")) return amount;
  return amount.replace(/0+$/, "").replace(/\.$/, "");
}

function bytesToString(value: unknown, encoding: BufferEncoding): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString(encoding);
  return String(value);
}

function parseMemo(memo: Memo): ParsedMemo {
  switch (memo.type) {
    case "text":
      return { type: "text", value: bytesToString(memo.value, "utf8") };
    case "id":
      return { type: "id", value: String(memo.value) };
    case "hash":
      return { type: "hash", value: bytesToString(memo.value, "hex") };
    case "return":
      return { type: "return", value: bytesToString(memo.value, "hex") };
    default:
      return { type: "none" };
  }
}

/**
 * Extract the transfers implied by a classic operation. Path payments report
 * the *maximum* the sender can spend (sendMax) or the exact sendAmount, which is
 * the conservative choice for policy evaluation.
 */
function transfersFor(op: OperationRecord): PaymentLike[] {
  switch (op.type) {
    case "payment":
      return [
        {
          destination: op.destination,
          asset: toAssetRef(op.asset),
          amount: normalizeAmount(op.amount),
        },
      ];
    case "createAccount":
      return [
        {
          destination: op.destination,
          asset: { type: "native", code: "XLM" },
          amount: normalizeAmount(op.startingBalance),
        },
      ];
    case "pathPaymentStrictSend":
      return [
        {
          destination: op.destination,
          asset: toAssetRef(op.sendAsset),
          amount: normalizeAmount(op.sendAmount),
        },
      ];
    case "pathPaymentStrictReceive":
      return [
        {
          destination: op.destination,
          asset: toAssetRef(op.sendAsset),
          amount: normalizeAmount(op.sendMax),
        },
      ];
    default:
      return [];
  }
}

interface HostFunctionInfo {
  contract: NonNullable<ParsedOperation["contract"]>;
  transfers: PaymentLike[];
}

function parseInvokeHostFunction(op: Operation.InvokeHostFunction): HostFunctionInfo {
  const fn = op.func;
  const transfers: PaymentLike[] = [];
  switch (fn.type) {
    case "hostFunctionTypeInvokeContract": {
      const invoke = fn.invokeContract;
      const contractId = Address.fromScAddress(invoke.contractAddress).toString();
      const functionName = invoke.functionName.toString();
      // Recognise the SEP-41 token `transfer(from, to, amount)` signature so
      // policy rules about amounts and destinations also cover Soroban tokens.
      if (functionName === "transfer" && invoke.args.length === 3) {
        try {
          const to = Address.fromScVal(invoke.args[1]!).toString();
          const amount = scValToNative(invoke.args[2]!) as bigint;
          transfers.push({
            destination: to,
            asset: { type: "contract", contractId },
            amount: amount.toString(),
          });
        } catch {
          // Not a standard token transfer; leave transfers empty.
        }
      }
      return {
        contract: { contractId, functionName, hostFunctionType: "invoke_contract" },
        transfers,
      };
    }
    case "hostFunctionTypeCreateContract":
    case "hostFunctionTypeCreateContractV2":
      return { contract: { hostFunctionType: "create_contract" }, transfers };
    case "hostFunctionTypeUploadContractWasm":
      return { contract: { hostFunctionType: "upload_wasm" }, transfers };
    default:
      return { contract: { hostFunctionType: "invoke_contract" }, transfers };
  }
}

function parseOperation(op: OperationRecord, index: number): ParsedOperation {
  const parsed: ParsedOperation = { index, type: op.type, transfers: transfersFor(op) };
  if (op.source) parsed.source = op.source;
  if (op.type === "invokeHostFunction") {
    const info = parseInvokeHostFunction(op);
    parsed.contract = info.contract;
    parsed.transfers = info.transfers;
  }
  return parsed;
}

/**
 * Parse a base64 transaction envelope XDR into a normalized ParsedTransaction.
 *
 * @throws TxGuardError with code INVALID_XDR when the envelope cannot be decoded.
 */
export function parseTransaction(
  envelopeXdr: string,
  networkPassphrase: string,
): ParsedTransaction {
  let envelope: Transaction | FeeBumpTransaction;
  try {
    envelope = TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  } catch (err) {
    throw new TxGuardError("INVALID_XDR", "Transaction envelope could not be decoded", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  let inner: Transaction;
  let feeBump: ParsedTransaction["feeBump"];
  if (envelope instanceof FeeBumpTransaction) {
    inner = envelope.innerTransaction;
    feeBump = { feeSource: envelope.feeSource, fee: envelope.fee };
  } else {
    inner = envelope;
  }

  const operations = inner.operations.map((op, i) => parseOperation(op, i));
  const parsed: ParsedTransaction = {
    networkPassphrase,
    hash: Buffer.from(inner.hash()).toString("hex"),
    source: inner.source,
    fee: inner.fee,
    sequence: inner.sequence,
    memo: parseMemo(inner.memo),
    operations,
    isSoroban: operations.some((o) => o.type === "invokeHostFunction"),
    signatureCount: envelope.signatures.length,
  };
  if (inner.timeBounds) {
    parsed.timeBounds = { minTime: inner.timeBounds.minTime, maxTime: inner.timeBounds.maxTime };
  }
  if (feeBump) parsed.feeBump = feeBump;
  return parsed;
}
