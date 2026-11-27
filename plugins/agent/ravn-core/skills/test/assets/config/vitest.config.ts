import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    sequence: { shuffle: true },
    retry: 0,
    allowOnly: false,
    passWithNoTests: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true
  }
})
