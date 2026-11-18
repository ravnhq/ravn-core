import { test, expect } from "bun:test"
test("behavior", () => { expect({total: 2}).toMatchSnapshot() })
