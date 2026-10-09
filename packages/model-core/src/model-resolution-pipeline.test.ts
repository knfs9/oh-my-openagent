import { describe, expect, test } from "bun:test";
import { resolveModelPipeline } from "./model-resolution-pipeline";

describe("resolveModelPipeline", () => {
	test("does not return unused explicit user config metadata in override result", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.5",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
		});

		// when
		const hasExplicitUserConfigField = result
			? Object.prototype.hasOwnProperty.call(result, "explicitUserConfig")
			: false;

		// then
		expect(result).toEqual({ model: "openai/gpt-5.5", provenance: "override" });
		expect(hasExplicitUserConfigField).toBe(false);
	});

	test("resolves catalog fallback entries that already include their provider exactly once", () => {
		const result = resolveModelPipeline({
			constraints: { availableModels: new Set(["openrouter/qwen3.5-plus"]) },
			policy: {
				fallbackChain: [{ providers: ["openrouter"], model: "openrouter/qwen3.5-plus" }],
			},
		})

		expect(result?.model).toBe("openrouter/qwen3.5-plus")
		expect(result?.provenance).toBe("provider-fallback")
	})

	test("does not resolve provider fallback entries through a different provider with the same model name", () => {
		// given
		const result = resolveModelPipeline({
			constraints: {
				availableModels: new Set(["other/claude-opus-4-7"]),
			},
			policy: {
				fallbackChain: [
					{
						providers: ["anthropic"],
						model: "claude-opus-4-7",
						variant: "max",
					},
				],
				systemDefaultModel: "openai/gpt-5.5",
			},
		});

		// when
		const resolvedModel = result?.model;

		// then
		expect(resolvedModel).toBe("openai/gpt-5.5");
		expect(result?.provenance).toBe("system-default");
	});
});

test("inherits the fallback variant for an explicit matching user model", () => {
	// given
	const result = resolveModelPipeline({
		intent: {
			userModel: "openai/gpt-5.6-sol",
		},
		constraints: {
			availableModels: new Set<string>(),
		},
		policy: {
			fallbackChain: [
				{
					providers: ["openai", "vercel"],
					model: "gpt-5.6-sol",
					variant: "high",
				},
			],
		},
	})

	// when
	const variant = result?.variant

	// then
	expect(result?.model).toBe("openai/gpt-5.6-sol")
	expect(result?.provenance).toBe("override")
	expect(variant).toBe("high")
})

test("inherits the fallback variant for an explicit transformed gateway model", () => {
	// given
	const result = resolveModelPipeline({
		intent: {
			userModel: "vercel/openai/gpt-5.6-sol",
		},
		constraints: {
			availableModels: new Set<string>(),
		},
		policy: {
			fallbackChain: [
				{
					providers: ["openai", "vercel"],
					model: "gpt-5.6-sol",
					variant: "high",
				},
			],
		},
	})

	// when
	const variant = result?.variant

	// then
	expect(result?.model).toBe("vercel/openai/gpt-5.6-sol")
	expect(result?.provenance).toBe("override")
	expect(variant).toBe("high")
})

describe("reasoning suffix on explicit user model override", () => {
	test("splits the :level suffix into a separate variant", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol:medium",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
		})

		// then
		expect(result).toEqual({
			model: "openai/gpt-5.6-sol",
			provenance: "override",
			variant: "medium",
		})
	})

	test("leaves clean model ids untouched", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
		})

		// then
		expect(result).toEqual({ model: "openai/gpt-5.6-sol", provenance: "override" })
	})

	test("passes through non-reasoning suffixes unchanged", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol:custom",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
		})

		// then
		expect(result).toEqual({ model: "openai/gpt-5.6-sol:custom", provenance: "override" })
	})

	test("explicit suffix takes precedence over the inherited fallback variant", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol:low",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
			policy: {
				fallbackChain: [
					{
						providers: ["openai"],
						model: "gpt-5.6-sol",
						variant: "high",
					},
				],
			},
		})

		// then
		expect(result).toEqual({
			model: "openai/gpt-5.6-sol",
			provenance: "override",
			variant: "low",
		})
	})

	test("still inherits the fallback variant when no suffix is present", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
			policy: {
				fallbackChain: [
					{
						providers: ["openai"],
						model: "gpt-5.6-sol",
						variant: "high",
					},
				],
			},
		})

		// then
		expect(result).toEqual({
			model: "openai/gpt-5.6-sol",
			provenance: "override",
			variant: "high",
		})
	})

	test("normalizes the parenthesized variant form", () => {
		// given
		const result = resolveModelPipeline({
			intent: {
				userModel: "openai/gpt-5.6-sol (medium)",
			},
			constraints: {
				availableModels: new Set<string>(),
			},
		})

		// then
		expect(result).toEqual({
			model: "openai/gpt-5.6-sol",
			provenance: "override",
			variant: "medium",
		})
	})
})
