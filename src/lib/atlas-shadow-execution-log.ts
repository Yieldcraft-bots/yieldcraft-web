export type AtlasShadowExecutionMode =
  | "SHADOW";

export interface AtlasShadowExecutionLog {
  generatedAt: string;

  mode: AtlasShadowExecutionMode;

  symbol: string;
  productId: string;

  quoteSizeUsd: number;

  success: boolean;

  responseSummary: string;
}

export function createAtlasShadowExecutionLog(
  input: Omit<
    AtlasShadowExecutionLog,
    "generatedAt"
  >
): AtlasShadowExecutionLog {
  return {
    generatedAt: new Date().toISOString(),
    ...input,
  };
}