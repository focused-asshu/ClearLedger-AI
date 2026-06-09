export interface AiProvider {
  name: string;
  summarizeAlert(input: { transactionId: string; riskFactors: string[] }): Promise<string>;
}

export class MockAiProvider implements AiProvider {
  name = "mock";

  async summarizeAlert(input: { transactionId: string; riskFactors: string[] }) {
    return `Transaction ${input.transactionId} needs review because: ${input.riskFactors.join(", ")}.`;
  }
}

export function createAiProvider() {
  // Future provider switch can route to Claude/OpenAI/etc. without changing app code.
  return new MockAiProvider();
}
