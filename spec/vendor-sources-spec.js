"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sources = require("../vendor/sources.json");
const vendor = path.join(__dirname, "..", "vendor");

describe("vendored source provenance", () => {
  for (const [name, source] of Object.entries(sources)) {
    it(`retains the recorded ${name} release bytes`, () => {
      for (const [file, expected] of Object.entries(source.sha256)) {
        const actual = crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(vendor, source.root || ".", file)))
          .digest("hex");
        expect(actual).withContext(file).toBe(expected);
      }
    });
  }

  it("builds the recorded Hunspell version and retains a matched UTF-8 dictionary", () => {
    const version = fs.readFileSync(
      path.join(vendor, "hunspell/src/hunspell/hunversion.h"),
      "utf8",
    );
    expect(version).toContain(`#define HUNSPELL_VERSION_STRING "${sources.hunspell.version}"`);
    const affix = fs.readFileSync(path.join(vendor, "hunspell_dictionaries/en_US.aff"), "utf8");
    expect(affix).toMatch(/^SET UTF-8$/m);
    const readme = fs.readFileSync(path.join(vendor, "hunspell_dictionaries/README.txt"), "utf8");
    expect(readme).toContain(`Version ${sources.en_US.version}`);
  });
});
