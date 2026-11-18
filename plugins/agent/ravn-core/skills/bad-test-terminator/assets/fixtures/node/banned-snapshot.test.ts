import { test } from "node:test"
import assert from "node:assert/strict"
test("behavior", (context) => { context.assert.snapshot({total: 2}) })
