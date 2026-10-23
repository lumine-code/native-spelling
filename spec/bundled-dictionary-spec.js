"use strict";

const { Spellchecker, ALWAYS_USE_HUNSPELL, getDictionaryPath } = require("../lib/spellchecker");

describe("bundled en_US dictionary", () => {
  let checker;

  beforeEach(() => {
    checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_HUNSPELL);
    expect(checker.setDictionary("en_US", getDictionaryPath())).toBe(true);
  });

  it("recognizes modern vocabulary and the affixes shipped with it", () => {
    for (const word of [
      "smartphone",
      "smartphones",
      "codebase",
      "codebases",
      "tokenize",
      "tokenization",
      "doomscrolling",
      "neurodiversity",
      "staycation",
      "ChatGPT",
      "LLM",
    ]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(false);
    }
  });

  it("uses the current place name and still recognizes ordinary American spellings", () => {
    for (const word of ["Kyiv", "color", "organize", "yogurt", "peddler", "ax", "axe"]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(false);
    }
    expect(checker.isMisspelled("Kiev")).toBe(true);
  });

  it("keeps the standard American dictionary's spelling choices", () => {
    for (const word of ["colour", "organise", "yoghurt", "yogourt", "pedlar"]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(true);
    }
  });

  it("suggests newly included words for their misspellings", () => {
    for (const [misspelling, correction] of [
      ["smartphne", "smartphone"],
      ["codebse", "codebase"],
      ["toknization", "tokenization"],
      ["doomscroling", "doomscrolling"],
      ["Kyvi", "Kyiv"],
    ]) {
      expect(checker.isMisspelled(misspelling)).withContext(misspelling).toBe(true);
      expect(checker.getCorrectionsForMisspelling(misspelling))
        .withContext(misspelling)
        .toContain(correction);
    }
  });

  it("accepts ASCII and Unicode apostrophes with the UTF-8 affix rules", () => {
    for (const word of ["can't", "can’t", "developer's", "developer’s"]) {
      expect(checker.isMisspelled(word)).withContext(word).toBe(false);
    }
  });

  it("checks the refreshed vocabulary and returns UTF-16 ranges around Unicode", async () => {
    const text = "😀 can’t tokenize the codebse on smartphones";
    const start = text.indexOf("codebse");
    const ranges = [{ start, end: start + "codebse".length }];

    expect(checker.checkSpelling(text)).toEqual(ranges);
    expect(await checker.checkSpellingAsync(text)).toEqual(ranges);
  });
});
