/** Prisma stores JSON fields as strings on SQLite — normalize for API/UI. */

export type ProofImage = {
  fileId: string;
  label: string;
  rMultiple: string;
  direction: string;
  description: string;
};

export function parseProofImages(value: unknown): ProofImage[] | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value as ProofImage[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as ProofImage[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeProofImages(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    // Already serialized — validate and re-normalize
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? JSON.stringify(parsed) : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  return null;
}

export function parseEquityCurve(value: unknown): Array<{ trade: number; value?: number; equity?: number }> | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value as Array<{ trade: number; value?: number; equity?: number }>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeStrategyRecord<T extends Record<string, unknown>>(strategy: T) {
  const proofImages = parseProofImages(strategy.proofImages);
  const backtest = strategy.backtest as Record<string, unknown> | null | undefined;
  let nextBacktest = backtest ?? null;
  if (backtest && "equityCurveData" in backtest) {
    nextBacktest = {
      ...backtest,
      equityCurveData: parseEquityCurve(backtest.equityCurveData),
    };
  }
  return {
    ...strategy,
    proofImages,
    backtest: nextBacktest,
  };
}
