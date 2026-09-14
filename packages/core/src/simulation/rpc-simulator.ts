import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { TxGuardError } from "../errors.js";
import type { SimulationResult, Simulator } from "./types.js";

export interface RpcSimulatorOptions {
  /** Stellar RPC endpoint, e.g. https://soroban-testnet.stellar.org */
  rpcUrl: string;
  /** Allow http:// for local development. */
  allowHttp?: boolean;
}

/** Simulates transactions against Stellar RPC (`simulateTransaction`). */
export class RpcSimulator implements Simulator {
  private readonly server: rpc.Server;

  constructor(opts: RpcSimulatorOptions) {
    this.server = new rpc.Server(opts.rpcUrl, { allowHttp: opts.allowHttp ?? false });
  }

  async simulate(envelopeXdr: string, networkPassphrase: string): Promise<SimulationResult> {
    const tx = TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
    let response: rpc.Api.SimulateTransactionResponse;
    try {
      response = await this.server.simulateTransaction(tx);
    } catch (err) {
      throw new TxGuardError("RPC_UNAVAILABLE", "simulation request failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    return mapSimulateResponse(response);
  }
}

export function mapSimulateResponse(
  response: rpc.Api.SimulateTransactionResponse,
): SimulationResult {
  if (rpc.Api.isSimulationError(response)) {
    return { status: "error", error: response.error, latestLedger: response.latestLedger };
  }
  if (rpc.Api.isSimulationRestore(response)) {
    return {
      status: "restore_required",
      error: "ledger entries must be restored before this transaction can succeed",
      minResourceFee: response.minResourceFee,
      latestLedger: response.latestLedger,
    };
  }
  const res = response.transactionData.build().resources;
  return {
    status: "success",
    minResourceFee: response.minResourceFee,
    resources: {
      cpuInstructions: res.instructions,
      memoryBytes: 0, // memory is not reported per-transaction by RPC; reserved for future use
      ledgerReadBytes: res.diskReadBytes,
      ledgerWriteBytes: res.writeBytes,
    },
    authEntryCount: response.result?.auth.length ?? 0,
    events: response.events.map((e) => e.toXDR("base64")),
    latestLedger: response.latestLedger,
  };
}
