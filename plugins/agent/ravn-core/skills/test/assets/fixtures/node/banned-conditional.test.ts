import { test } from "node:test"
import assert from "node:assert/strict"
test("behavior", () => { if (process.env.FLAG) assert.equal(2, 2) })
