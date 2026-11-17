import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("allowed", () => {
  it("fixed instant", () => {
    expect(new Date("2026-01-01T00:00:00Z").getUTCFullYear()).toBe(2026)
  })

  it("fake clock", () => {
    const received: Array<string> = []
    const record = vi.fn((value: string) => received.push(value))
    record("first")
    vi.advanceTimersByTime(1000)
    expect(received).toEqual(["first"])
  })

  it("explicitly not retried", { retry: 0 }, () => {
    expect(1).toBe(1)
  })

  it.skipIf(process.platform === "win32")("platform condition", () => {
    expect(1).toBe(1)
  })

  it.each([1, 2])("case %i", (value) => {
    expect(value).toBeGreaterThan(0)
  })

  it.todo("planned test")
})
