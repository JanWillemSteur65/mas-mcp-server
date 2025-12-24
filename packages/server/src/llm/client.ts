/**
 * Minimal provider abstraction placeholder.
 * In this repo we keep the agent tool-first and deterministic.
 * You can expand this to call OpenAI/Anthropic/Gemini/Mistral/watsonx APIs.
 */
export async function llmChat(_provider: string, _model: string, _messages: Array<{ role: string; content: string }>): Promise<string> {
  // Tool-first mode: we return a simple summarization stub.
  return "I retrieved data via MCP tools. Review the results below.";
}
