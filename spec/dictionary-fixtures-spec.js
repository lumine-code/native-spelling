"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Spellchecker, ALWAYS_USE_HUNSPELL, getDictionaryPath } = require("../lib/spellchecker");

const directory = path.join(__dirname, "dictionaries");

function checkerFor(language) {
  const checker = new Spellchecker();
  checker.setSpellcheckerType(ALWAYS_USE_HUNSPELL);
  expect(checker.setDictionary(language, directory)).withContext(language).toBe(true);
  return checker;
}

describe("maintained Hunspell dictionary fixtures", () => {
  it("uses the shipped American English release as its English fixture", () => {
    for (const extension of ["aff", "dic"]) {
      const name = `en_US.${extension}`;
      expect(fs.readFileSync(path.join(directory, name)))
        .withContext(name)
        .toEqual(fs.readFileSync(path.join(getDictionaryPath(), name)));
    }

    const checker = checkerFor("en_US");
    for (const word of ["doomscrolling", "neurodiversity", "smartphones", "can’t"]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(false);
    }
    expect(checker.getCorrectionsForMisspelling("doomscroling")).toContain("doomscrolling");
  });

  for (const language of ["de_DE_frami", "de_DE"]) {
    it(`recognizes updated German vocabulary and accented compounds through ${language}`, () => {
      const checker = checkerFor(language);
      for (const word of ["Selfie", "Selfies", "Straße", "Fußgänger", "Fußgängerzone"]) {
        expect(checker.isMisspelled(word)).withContext(word).toBe(false);
      }
      for (const [misspelling, correction] of [
        ["Selfei", "Selfie"],
        ["Fußgängr", "Fußgänger"],
        ["möchtzn", "möchten"],
      ]) {
        expect(checker.isMisspelled(misspelling)).withContext(misspelling).toBe(true);
        expect(checker.getCorrectionsForMisspelling(misspelling))
          .withContext(misspelling)
          .toContain(correction);
      }
    });
  }

  it("returns identical German UTF-16 ranges from the ISO and UTF-8 fixtures", async () => {
    const text = "😀 Selfies in der Fußgängerzone möchtzn";
    const start = text.indexOf("möchtzn");
    const ranges = [{ start, end: start + "möchtzn".length }];
    const legacy = checkerFor("de_DE_frami");
    const unicode = checkerFor("de_DE");

    expect(legacy.checkSpelling(text)).toEqual(ranges);
    expect(unicode.checkSpelling(text)).toEqual(ranges);
    expect(await legacy.checkSpellingAsync(text)).toEqual(ranges);
    expect(await unicode.checkSpellingAsync(text)).toEqual(ranges);
  });

  it("recognizes current French vocabulary, inflections and ligatures", () => {
    const checker = checkerFor("fr");
    for (const word of [
      "télétravailler",
      "télétravaillons",
      "influenceur",
      "influenceuse",
      "émoji",
      "émojis",
      "événement",
      "évènement",
      "cœur",
      "cœurs",
      "œuvre",
      "œuvres",
    ]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(false);
    }
    for (const [misspelling, correction] of [
      ["télétravaillr", "télétravailler"],
      ["influenseur", "influenceur"],
      ["coeur", "cœur"],
      ["coeurs", "cœurs"],
    ]) {
      expect(checker.isMisspelled(misspelling)).withContext(misspelling).toBe(true);
      expect(checker.getCorrectionsForMisspelling(misspelling))
        .withContext(misspelling)
        .toContain(correction);
    }
  });

  it("checks the updated French vocabulary around surrogate pairs", async () => {
    const checker = checkerFor("fr");
    const text = "😀 nous télétravaillons avec des émojis et des coeurs";
    const start = text.indexOf("coeurs");
    const ranges = [{ start, end: start + "coeurs".length }];

    expect(checker.checkSpelling(text)).toEqual(ranges);
    expect(await checker.checkSpellingAsync(text)).toEqual(ranges);
  });
});
