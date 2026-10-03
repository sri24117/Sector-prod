// LLM call wrapper. Every call here is for generation/summarization/classification — never for a
// decision that must be deterministic (permissions, compliance facts, consent, money). CLAUDE.md §2.
//
// PROVIDER/MODEL CHOICE IS A HUMAN DECISION (docs/architecture/architecture.md §5), so nothing is
// hard-coded: set LLM_PROVIDER=anthropic, ANTHROPIC_API_KEY and LLM_MODEL. Unset => NotConfiguredError
// (callers return 501), never a silent fake.

export interface LlmProvider {
  complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<{ text: string; model: string }>;
}

export interface GenerationRequest {
  skillId: string; // matches a file in /skills
  organizationId: string;
  system: string;
  prompt: string;
}
export interface GenerationResult { text: string; model: string; skillId: string; }

export class NotConfiguredError extends Error {
  constructor() { super("No LLM provider is configured (set LLM_PROVIDER, ANTHROPIC_API_KEY, LLM_MODEL)."); this.name = "NotConfiguredError"; }
}

export function anthropicProvider(apiKey: string, model: string): LlmProvider {
  return {
    async complete({ system, prompt, maxTokens }) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens ?? 1500, system, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`LLM provider returned ${res.status}`); // body deliberately not echoed
      const data = (await res.json()) as { content?: { type: string; text?: string }[]; model?: string };
      const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      if (!text) throw new Error("LLM provider returned no text");
      return { text, model: data.model ?? model };
    },
  };
}

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  if (env.LLM_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY && env.LLM_MODEL) return anthropicProvider(env.ANTHROPIC_API_KEY, env.LLM_MODEL);
  throw new NotConfiguredError();
}

export async function generate(request: GenerationRequest, provider: LlmProvider = providerFromEnv()): Promise<GenerationResult> {
  const out = await provider.complete({ system: request.system, prompt: request.prompt });
  return { text: out.text, model: out.model, skillId: request.skillId };
}
