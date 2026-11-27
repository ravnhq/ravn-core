import { assert, describe, expect, it, layer } from "@effect/vitest"
import { Effect, Fiber, Layer } from "effect"
import { TestClock } from "effect/testing"

describe("allowed with Effect", () => {
  it.effect("virtual time", () =>
    Effect.gen(function*() {
      const sleeper = yield* Effect.sleep("1 hour").pipe(Effect.as("done"), Effect.forkChild)
      yield* TestClock.adjust("1 hour")
      assert.strictEqual(yield* Fiber.join(sleeper), "done")
    }))

  it.effect("expect inside an effect test", () =>
    Effect.sync(() => {
      expect(1).toBe(1)
    }))

  it.effect.each([1, 2])("case %i", (value) =>
    Effect.sync(() => {
      expect(value).toBeGreaterThan(0)
    }))

  layer(Layer.empty)("shared layer", (it) => {
    it.effect("uses the layer", () =>
      Effect.sync(() => {
        expect(1).toBe(1)
      }))
  })
})
