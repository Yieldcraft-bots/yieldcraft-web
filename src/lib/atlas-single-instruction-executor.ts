import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";
import type {
  AtlasInstructionExecutionResult,
} from "./atlas-multi-asset-dispatcher";

export type AtlasInstructionExecutionHandler = (
  instruction: AtlasExecutionInstruction
) => Promise<unknown>;

export async function executeAtlasInstruction(
  instruction: AtlasExecutionInstruction,
  handler: AtlasInstructionExecutionHandler
): Promise<AtlasInstructionExecutionResult> {
  try {
    const response = await handler(instruction);

    return {
      instruction,
      success: true,
      response,
    };
  } catch (error) {
    return {
      instruction,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}