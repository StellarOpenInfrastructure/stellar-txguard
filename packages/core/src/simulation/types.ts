/**
 * Provider-agnostic simulation result. `RpcSimulator` maps Stellar RPC
 * responses onto this shape; `StaticSimulator` returns canned results for tests
 * and offline policy evaluation.
 */
export interface SimulationResult {
  status: "success" | "error" | "restore_required";
  /** Provider error message when status !== "success". Never contains secrets. */
  error?: string;
  /** Minimum resource fee in stroops reported by the network. */
  minResourceFee?: string;
  resources?: {
    cpuInstructions: number;
    memoryBytes: number;
    ledgerReadBytes: number;
    ledgerWriteBytes: number;
  };
  /** Number of authorization entries the transaction needs. */
  authEntryCount?: number;
  /** Diagnostic / contract events emitted during simulation (XDR base64). */
  events?: string[];
  /** Latest ledger observed by the provider. */
  latestLedger?: number;
}

export interface Simulator {
  simulate(envelopeXdr: string, networkPassphrase: string): Promise<SimulationResult>;
}
