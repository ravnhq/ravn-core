import { expect, it, live, vi } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { TestClock } from "effect/testing"

live("imported live", () => Effect.sync(() => expect(1).toBe(1)))

it.live("live test", () => Effect.sync(() => expect(1).toBe(1)))

it.flakyTest(Effect.void)

vi.useFakeTimers()

it.effect.only("focused effect test", () => Effect.sync(() => expect(1).toBe(1)))

it.effect.skip("skipped effect test", () => Effect.sync(() => expect(1).toBe(1)))

it.effect("fresh runtime", () =>
  Effect.sync(() => {
    void Effect.runPromise(Effect.void)
    expect(1).toBe(1)
  }))

it.effect("live clock", () => TestClock.withLive(Effect.sync(() => expect(1).toBe(1))))

it.effect("no assertion", () => Effect.void)

it.layer(Layer.empty, { excludeTestServices: true })("without test services", (test) => {
  test.effect("real network", () => Effect.sync(() => expect(FetchHttpClient.layer).toBeDefined()))
})
