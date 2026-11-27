import { describe, expect, it } from "bun:test"

describe("behavior", () => {
  it("records delivered values", () => {
    const delivered: string[] = []
    const deliver = (value: string) => delivered.push(value)
    deliver("message")
    expect(delivered).toEqual(["message"])
  })
  it("uses a fixed instant", () => {
    expect(new Date("2026-01-01T00:00:00Z").getUTCFullYear()).toBe(2026)
  })
})
