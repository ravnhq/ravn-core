import { strictEqual as equal, deepStrictEqual } from "node:assert"
import * as runner from "node:test"
import check from "node:test"

runner.test("records deliveries", () => {
  const received: string[] = []
  const deliver = (value: string) => received.push(value)
  deliver("message")
  deepStrictEqual(received, ["message"])
})
check("fixed instant", (context) => {
  context.assert.strictEqual(new Date("2026-01-01T00:00:00Z").getUTCFullYear(), 2026)
})
check("platform", { skip: process.platform === "win32", only: false }, () => {
  equal(1 + 1, 2)
})

check("subtest container", async (context) => {
  await context.test("delivers the result", (child) => {
    child.assert.strictEqual(1 + 1, 2)
  })
})
