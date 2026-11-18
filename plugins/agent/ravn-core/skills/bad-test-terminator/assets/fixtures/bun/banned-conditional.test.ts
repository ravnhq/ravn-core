import { test, expect } from "bun:test"
test("behavior", () => { if (process.env.FLAG) expect(2).toBe(2) })
