import assert from "node:assert/strict"
import { test as check, mock as doubles } from "node:test"
import { setTimeout as sleep } from "node:timers/promises"

check.only("focused", () => { assert.equal(1, 1) })
check("skipped", { skip: true }, () => { assert.equal(1, 1) })
check("options focus", { only: true }, () => { assert.equal(1, 1) })
check("retried", { retry: 2 }, () => { assert.equal(1, 1) })
check("time and network", async () => {
  setTimeout(() => undefined, 10)
  await sleep(10)
  assert.ok(Date.now())
  assert.ok(performance.now())
  assert.ok(new Date())
  assert.ok(Math.random())
  assert.ok(await fetch("https://example.com"))
})
check("spies", (context) => {
  doubles.method(console, "log")
  context.mock.method(console, "log")
  doubles.module("./dependency")
  assert.equal(1, 1)
})
check("snapshot", (context) => { context.assert.snapshot({ total: 1 }) })
check("mock calls", () => {
  const fake = doubles.fn()
  assert.equal(fake.mock.callCount(), 0)
})
check("no assertion", () => { const total = 2; void total })
