import { test } from "node:test"
import assert from "node:assert/strict"
test("behavior", (context) => { const fake = context.mock.fn(); assert.equal(fake.mock.callCount(), 0) })
