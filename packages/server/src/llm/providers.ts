export type ProviderInfo = { name: string; configured: boolean; models: string[] };

function parseModels(envName: string): string[] {
  const v = (process.env[envName] ?? "").trim();
  if (!v) return [];
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

export function listConfiguredProviders(): ProviderInfo[] {
  const defs: Array<{ name: string; keys: string[]; modelsEnv: string }> = [
    { name: "openai", keys: ["OPENAI_API_KEY"], modelsEnv: "OPENAI_MODELS" },
    { name: "anthropic", keys: ["ANTHROPIC_API_KEY"], modelsEnv: "ANTHROPIC_MODELS" },
    { name: "gemini", keys: ["GEMINI_API_KEY"], modelsEnv: "GEMINI_MODELS" },
    { name: "mistral", keys: ["MISTRAL_API_KEY"], modelsEnv: "MISTRAL_MODELS" },
    { name: "watsonx", keys: ["WATSONX_API_KEY","WATSONX_URL","WATSONX_PROJECT_ID"], modelsEnv: "WATSONX_MODELS" },
  ];
  return defs.map(d => ({
    name: d.name,
    configured: d.keys.every(k => Boolean((process.env[k] ?? "").trim())),
    models: parseModels(d.modelsEnv),
  }));
}
