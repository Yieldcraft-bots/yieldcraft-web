import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";

export interface AtlasInstructionExecutionResult {
  instruction: AtlasExecutionInstruction;
  success: boolean;
  error?: string;
  response?: unknown;
}

export interface AtlasDispatcherResult {
  success: boolean;
  executed: number;
  failed: number;
  results: AtlasInstructionExecutionResult[];
}

export type AtlasInstructionExecutor = (
  instruction: AtlasExecutionInstruction
) => Promise<AtlasInstructionExecutionResult>;

export async function dispatchAtlasExecutionInstructions(
  instructions: AtlasExecutionInstruction[],
  execute: AtlasInstructionExecutor,
  stopOnFailure = true
): Promise<AtlasDispatcherResult> {
  const results: AtlasInstructionExecutionResult[] = [];

  let executed = 0;
  let failed = 0;

  for (const instruction of instructions) {
    const result = await execute(instruction);

    results.push(result);

    if (result.success) {
      executed++;
      continue;
    }

    failed++;

    if (stopOnFailure) {
      break;
    }
  }

  return {
    success: failed === 0,
    executed,
    failed,
    results,
  };
}