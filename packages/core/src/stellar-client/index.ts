import { Horizon, rpc } from "@stellar/stellar-sdk";
import { TxGuardError } from "../errors.js";

export const NETWORKS = {
  testnet: {
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "", // bring your own RPC provider for mainnet
    horizonUrl: "https://horizon.stellar.org",
  },
} as const;

export interface AccountSnapshot {
  id: string;
  sequence: string;
  /** Balances keyed by asset key ("native" or "CODE:ISSUER"). */
  balances: Record<string, string>;
  signerCount: number;
  thresholds: { low: number; medium: number; high: number };
}

/**
 * Read-only access to ledger state. Stellar RPC is the primary source; Horizon
 * is used only for the account balances/thresholds summary because RPC exposes
 * raw ledger entries rather than a convenient account view.
 */
export interface StellarClient {
  getLatestLedger(): Promise<number>;
  getAccount(accountId: string): Promise<AccountSnapshot | null>;
}

export interface StellarClientOptions {
  rpcUrl: string;
  horizonUrl?: string;
  allowHttp?: boolean;
}

export class NetworkStellarClient implements StellarClient {
  private readonly rpcServer: rpc.Server;
  private readonly horizon?: Horizon.Server;

  constructor(opts: StellarClientOptions) {
    this.rpcServer = new rpc.Server(opts.rpcUrl, { allowHttp: opts.allowHttp ?? false });
    if (opts.horizonUrl)
      this.horizon = new Horizon.Server(opts.horizonUrl, { allowHttp: opts.allowHttp ?? false });
  }

  async getLatestLedger(): Promise<number> {
    try {
      return (await this.rpcServer.getLatestLedger()).sequence;
    } catch (err) {
      throw new TxGuardError("RPC_UNAVAILABLE", "could not fetch latest ledger", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getAccount(accountId: string): Promise<AccountSnapshot | null> {
    if (!this.horizon) {
      throw new TxGuardError("INTERNAL", "horizonUrl is required for getAccount in this scaffold");
    }
    try {
      const acc = await this.horizon.loadAccount(accountId);
      const balances: Record<string, string> = {};
      for (const b of acc.balances) {
        if (b.asset_type === "native") balances.native = b.balance;
        else if ("asset_code" in b && "asset_issuer" in b)
          balances[`${b.asset_code}:${b.asset_issuer}`] = b.balance;
      }
      return {
        id: acc.id,
        sequence: acc.sequence,
        balances,
        signerCount: acc.signers.length,
        thresholds: {
          low: acc.thresholds.low_threshold,
          medium: acc.thresholds.med_threshold,
          high: acc.thresholds.high_threshold,
        },
      };
    } catch (err) {
      if (err instanceof Error && /404|not found/i.test(err.message)) return null;
      throw new TxGuardError("RPC_UNAVAILABLE", "could not load account", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Static client for tests. */
export class StaticStellarClient implements StellarClient {
  constructor(
    private readonly ledger: number,
    private readonly accounts: Record<string, AccountSnapshot> = {},
  ) {}
  async getLatestLedger(): Promise<number> {
    return this.ledger;
  }
  async getAccount(accountId: string): Promise<AccountSnapshot | null> {
    return this.accounts[accountId] ?? null;
  }
}
