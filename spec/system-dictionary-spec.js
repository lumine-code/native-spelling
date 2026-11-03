"use strict";

const { Spellchecker, ALWAYS_USE_SYSTEM } = require("../lib/spellchecker");

// The system service exists on Windows and macOS; Linux has Hunspell only.
const hasSystemService = process.platform === "win32" || process.platform === "darwin";
const systemServiceSuite = hasSystemService ? describe : () => {};

systemServiceSuite("setDictionary with no language", () => {
  it("selects a system default rather than failing", () => {
    const checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_SYSTEM);

    // An empty language means "whatever the system is set to". Both platforms
    // that have a system service honour it.
    expect(checker.setDictionary("", "")).toBe(true);
    expect(checker.isMisspelled("mispelled")).toBe(true);
    expect(checker.isMisspelled("misspelled")).toBe(false);
  });

  it("still rejects a language the system does not have", () => {
    const checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_SYSTEM);

    expect(checker.setDictionary("zz-ZZ", "")).toBe(false);
  });
});

// macOS provides this dictionary with its system service. Windows coverage
// uses its installed default language and the portable Hunspell French fixture.
const macOSFrenchSuite = process.platform === "darwin" ? describe : () => {};
macOSFrenchSuite("macOS French Unicode corrections", () => {
  it("returns valid Unicode alternatives for an already-correct French word", () => {
    const checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_SYSTEM);
    expect(checker.setDictionary("fr", "")).toBe(true);
    expect(checker.isMisspelled("Française")).toBe(false);

    // The system owns the alternatives and can change them with an OS update.
    // Validate Unicode and dictionary membership rather than its current list.
    const corrections = checker.getCorrectionsForMisspelling("Française");
    expect(Array.isArray(corrections)).toBe(true);
    expect(corrections.length).toBeGreaterThan(0);
    for (const correction of corrections) {
      expect(typeof correction).toBe("string");
      expect(correction.length).toBeGreaterThan(0);
      expect(Buffer.from(correction, "utf8").toString("utf8")).toBe(correction);
      expect(correction).not.toContain("\ufffd");
    }
    expect(
      corrections.some(
        (correction) => /\P{ASCII}/u.test(correction) && !checker.isMisspelled(correction),
      ),
    ).toBe(true);
  });

  it("corrects the Unicode French misspelling through the system service", () => {
    const checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_SYSTEM);
    expect(checker.setDictionary("fr", "")).toBe(true);
    expect(checker.getCorrectionsForMisspelling("Françoize")[0]).toBe("Françoise");
  });
});
