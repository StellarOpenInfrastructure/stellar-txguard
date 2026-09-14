import type { SimulationResult, Simulator } from "./types.js";

/** Returns a fixed result. Useful for tests and for evaluating policies offline. */
export class StaticSimulator implements Simulator {
  constructor(private readonly result: SimulationResult) {}

  async simulate(): Promise<SimulationResult> {
    return this.result;
  }
}
