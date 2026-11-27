import { setTimeout as sleep } from "node:timers/promises"
import { describe, expect, it, mock, spyOn } from "bun:test"

describe.only("focused suite", () => {
  it.skip("skipped test", () => {
    expect(1).toBe(1)
  })

  it("retried test", { retry: 2 }, () => {
    expect(1).toBe(1)
  })

  it("real timer", async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    await sleep(10)
    expect(1).toBe(1)
  })

  it("timer on the global object", () => {
    globalThis.setInterval(() => undefined, 10)
    expect(1).toBe(1)
  })

  it("wall clock", () => {
    expect(Date.now()).toBeGreaterThan(0)
  })

  it("current date", () => {
    expect(new Date().getTime()).toBeGreaterThan(0)
  })

  it("random input", () => {
    expect(Math.random()).toBeLessThan(1)
  })

  it("real network", async () => {
    const response = await fetch("https://example.com")
    expect(response.ok).toBe(true)
  })

  it("module mock", () => {
    mock.module("./dependency")
    expect(1).toBe(1)
  })

  it("spy and call assertion", () => {
    const log = spyOn(console, "log")
    expect(log).toHaveBeenCalledTimes(0)
  })

  it("snapshot", () => {
    expect({ total: 1 }).toMatchSnapshot()
  })

  it("monotonic clock", () => {
    expect(performance.now()).toBeGreaterThan(0)
  })

  it("no assertion", () => {
    const total = 1 + 1
    void total
  })

  it("assertion without a matcher", () => {
    expect(1)
  })

  it("assertion that may not run", () => {
    try {
      JSON.parse("{}")
    } catch (error) {
      expect(error).toBeDefined()
    }
  })

  expect("outside a test").toBeDefined()
})
