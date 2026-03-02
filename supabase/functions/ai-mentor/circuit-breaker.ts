// circuit-breaker.ts – Circuit breaker for upstream API protection
// deno-lint-ignore-file

import { CONFIG } from "./config.ts";

interface CircuitState {
  failures: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  openedAt: number | undefined;
  halfOpenAt: number | undefined;
}

const circuit: CircuitState = {
  failures: 0,
  state: "CLOSED",
  openedAt: undefined,
  halfOpenAt: undefined,
};

export function circuitStatus(): "CLOSED" | "OPEN" | "HALF_OPEN" {
  const nowMs = Date.now();
  if (circuit.state === "OPEN") {
    if (circuit.openedAt && nowMs - circuit.openedAt > CONFIG.CB_HALF_OPEN_AFTER_MS) {
      circuit.state = "HALF_OPEN";
      circuit.halfOpenAt = nowMs;
    }
  } else if (circuit.state === "HALF_OPEN") {
    if (circuit.halfOpenAt && nowMs - circuit.halfOpenAt > CONFIG.CB_RESET_AFTER_MS) {
      circuit.state = "CLOSED";
      circuit.failures = 0;
      circuit.openedAt = undefined;
      circuit.halfOpenAt = undefined;
    }
  }
  return circuit.state;
}

export function circuitRecordSuccess(): void {
  circuit.failures = 0;
  circuit.state = "CLOSED";
  circuit.openedAt = undefined;
  circuit.halfOpenAt = undefined;
}

export function circuitRecordFailure(): void {
  circuit.failures += 1;
  if (circuit.failures >= CONFIG.CB_FAILURE_THRESHOLD) {
    circuit.state = "OPEN";
    circuit.openedAt = Date.now();
  }
}
