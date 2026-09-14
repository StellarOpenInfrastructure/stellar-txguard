import type { AssetRef } from "../transaction-parser/types.js";
import { assetKey } from "../transaction-parser/types.js";

const CLASSIC_DECIMALS = 7n;
const CLASSIC_SCALE = 10n ** CLASSIC_DECIMALS;

/**
 * Convert an amount string to integer units for exact comparison.
 * Classic assets use 7 decimals (stroops). Contract assets are already in
 * raw integer units, so decimal points are rejected for them.
 */
export function toUnits(amount: string, asset: AssetRef): bigint {
  if (asset.type === "contract") {
    if (!/^\d+$/.test(amount))
      throw new Error(`contract asset amount must be an integer: ${amount}`);
    return BigInt(amount);
  }
  const [whole = "0", frac = ""] = amount.split(".");
  if (!/^\d+$/.test(whole) || (frac && !/^\d{1,7}$/.test(frac))) {
    throw new Error(`invalid classic amount: ${amount}`);
  }
  return BigInt(whole) * CLASSIC_SCALE + BigInt(frac.padEnd(7, "0") || "0");
}

/** Format integer units back to a display string. */
export function fromUnits(units: bigint, asset: AssetRef): string {
  if (asset.type === "contract") return units.toString();
  const whole = units / CLASSIC_SCALE;
  const frac = (units % CLASSIC_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** True if the selector ("*", "native", "CODE:ISSUER", "contract:C...") matches the asset. */
export function selectorMatches(selector: string, asset: AssetRef): boolean {
  if (selector === "*") return true;
  return selector === assetKey(asset);
}

/** Sum transfers per asset key. */
export function totalsByAsset(
  transfers: { asset: AssetRef; amount: string }[],
): Map<string, { asset: AssetRef; total: bigint }> {
  const totals = new Map<string, { asset: AssetRef; total: bigint }>();
  for (const t of transfers) {
    const key = assetKey(t.asset);
    const entry = totals.get(key) ?? { asset: t.asset, total: 0n };
    entry.total += toUnits(t.amount, t.asset);
    totals.set(key, entry);
  }
  return totals;
}
