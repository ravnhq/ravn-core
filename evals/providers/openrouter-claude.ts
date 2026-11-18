export function openRouterClaudeEnvironment(model: string) {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key)
    throw new Error("Set OPENROUTER_API_KEY for the OpenRouter Claude route.");

  const modelName = model.replace(/^anthropic\//, "");

  return {
    CLAUDE_CODE_OAUTH_TOKEN: "",
    ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_DEFAULT_SONNET_MODEL: modelName,
    ANTHROPIC_DEFAULT_OPUS_MODEL: modelName,
    ANTHROPIC_MODEL: model,
  };
}
