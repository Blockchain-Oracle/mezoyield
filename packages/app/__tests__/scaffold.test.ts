import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("App scaffold", () => {
  const root = resolve(__dirname, "..");

  it("has required config files", () => {
    expect(existsSync(resolve(root, "next.config.js"))).toBe(true);
    expect(existsSync(resolve(root, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(root, "package.json"))).toBe(true);
  });

  it("has app directory with layout and page", () => {
    expect(existsSync(resolve(root, "app/layout.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "app/page.tsx"))).toBe(true);
  });
});
