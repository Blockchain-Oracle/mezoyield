import { expect } from "chai";
import { existsSync } from "fs";
import { resolve } from "path";

describe("Contracts scaffold", function () {
  const root = resolve(__dirname, "..");

  it("has hardhat config", function () {
    expect(existsSync(resolve(root, "hardhat.config.ts"))).to.be.true;
  });

  it("has contracts directory", function () {
    expect(existsSync(resolve(root, "contracts"))).to.be.true;
  });
});
