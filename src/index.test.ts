import { describe, it, expect } from "vitest"
import { extractCommandGroup } from "./index.js"

describe("extractCommandGroup", () => {
  it("extracts git command group", () => {
    expect(extractCommandGroup("git status")).toBe("git")
    expect(extractCommandGroup("git diff abafd15..a7d1836")).toBe("git")
  })

  it("extracts package manager commands", () => {
    expect(extractCommandGroup("pnpm dev")).toBe("pnpm")
    expect(extractCommandGroup("npm test -- --run")).toBe("npm")
  })

  it("handles comma-separated commands", () => {
    expect(extractCommandGroup("git status,git diff --stat")).toBe("git")
  })

  it("returns first word for unknown commands", () => {
    expect(extractCommandGroup("mkdir -p dir")).toBe("mkdir")
  })
})
