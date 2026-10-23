const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Spellchecker, ALWAYS_USE_HUNSPELL } = require("../lib/spellchecker");

describe("Hunspell Unicode and native buffer safety", () => {
  let directory;
  const longSuggestion = ["é".repeat(90), "ö".repeat(90), "ü".repeat(90)].join(" ");

  function writeDictionary(name, encoding, words) {
    const affix = [
      `SET ${encoding === "latin1" ? "ISO8859-1" : "UTF-8"}`,
      "TRY abcdefghijklmnopqrstuvwxyzéöü",
      "REP 2",
      "REP cafe café",
      `REP longtypo ${longSuggestion.replaceAll(" ", "_")}`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(directory, `${name}.aff`), affix, encoding);
    fs.writeFileSync(
      path.join(directory, `${name}.dic`),
      `${words.length}\n${words.join("\n")}\n`,
      encoding,
    );
  }

  function createChecker(name = "utf8") {
    const checker = new Spellchecker();
    checker.setSpellcheckerType(ALWAYS_USE_HUNSPELL);
    expect(checker.setDictionary(name, directory)).toBe(true);
    return checker;
  }

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-spelling-safety-"));
    const words = ["hello", "world", "résumé", "naïve", "café", ...longSuggestion.split(" ")];
    writeDictionary("utf8", "utf8", [...words, "東京"]);
    writeDictionary("latin1", "latin1", words);
    fs.writeFileSync(path.join(directory, "unsupported.aff"), "SET X-NOT-AN-ENCODING\n");
    fs.writeFileSync(path.join(directory, "unsupported.dic"), "1\nhello\n");
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("checks words at the 256-byte limit and skips longer inputs", async () => {
    const checker = createChecker();
    for (const word of ["a".repeat(256), "ö".repeat(128), "अ".repeat(85)]) {
      expect(Buffer.byteLength(word)).toBeLessThanOrEqual(256);
      expect(checker.isMisspelled(word)).toBe(true);
    }

    const boundary = "a".repeat(256);
    const text = `${boundary} hello ${boundary}`;
    const ranges = [
      { start: 0, end: 256 },
      { start: 263, end: 519 },
    ];
    expect(checker.checkSpelling(text)).toEqual(ranges);
    expect(await checker.checkSpellingAsync(text)).toEqual(ranges);

    for (const word of ["a".repeat(257), "ö".repeat(129), "अ".repeat(86), "𐅐".repeat(65)]) {
      expect(Buffer.byteLength(word)).toBeGreaterThan(256);
      expect(checker.isMisspelled(word)).toBe(false);
      expect(checker.getCorrectionsForMisspelling(word)).toEqual([]);
      expect(checker.checkSpelling(`${word} ${word}`)).toEqual([]);
      checker.add(word);
      checker.remove(word);
    }
    expect(checker.isMisspelled("hello")).toBe(false);
  });

  for (const dictionary of ["utf8", "latin1"]) {
    it(`round-trips Unicode words and suggestions through ${dictionary}`, () => {
      const checker = createChecker(dictionary);
      expect(checker.isMisspelled("résumé")).toBe(false);
      expect(checker.isMisspelled("naïve")).toBe(false);
      expect(checker.getCorrectionsForMisspelling("cafe")).toContain("café");

      const word = "éclairzz";
      expect(checker.isMisspelled(word)).toBe(true);
      checker.add(word);
      expect(checker.isMisspelled(word)).toBe(false);
      checker.remove(word);
      expect(checker.isMisspelled(word)).toBe(true);
    });
  }

  it("returns complete legacy-encoded suggestions larger than the old fixed buffer", () => {
    const checker = createChecker("latin1");
    expect(Buffer.byteLength(longSuggestion)).toBeGreaterThan(513);
    expect(checker.getCorrectionsForMisspelling("longtypo")).toContain(longSuggestion);
  });

  it("does not add a best-fit approximation of an unrepresentable Unicode word", () => {
    const checker = createChecker("latin1");
    expect(checker.isMisspelled("qlzx")).toBe(true);
    checker.add("qłzx");
    expect(checker.isMisspelled("qlzx")).toBe(true);
    checker.remove("qłzx");
    expect(checker.isMisspelled("hello")).toBe(false);
  });

  it("keeps the current dictionary when another dictionary cannot be opened or converted", () => {
    const checker = createChecker();
    for (const dictionary of ["missing", "unsupported"]) {
      expect(checker.setDictionary(dictionary, directory)).toBe(false);
      expect(checker.isMisspelled("東京")).toBe(false);
      expect(checker.getCorrectionsForMisspelling("cafe")).toContain("café");
    }
  });

  it("opens UTF-8 dictionary paths containing accented and non-Latin characters", () => {
    const unicodeDirectory = path.join(directory, "Zażółć 東京");
    fs.mkdirSync(unicodeDirectory);
    for (const extension of ["aff", "dic"]) {
      fs.copyFileSync(
        path.join(directory, `utf8.${extension}`),
        path.join(unicodeDirectory, `utf8.${extension}`),
      );
    }
    const checker = createChecker();
    expect(checker.setDictionary("utf8", unicodeDirectory)).toBe(true);
    expect(checker.isMisspelled("東京")).toBe(false);
    expect(checker.getCorrectionsForMisspelling("cafe")).toContain("café");
  });

  it("continues checking after lone surrogates and empty or embedded-NUL input", () => {
    const checker = createChecker();
    for (const text of ["", "\ud800", "\udc00", "\ud800 hello \udc00", "hello\0world"]) {
      expect(() => checker.checkSpelling(text)).not.toThrow();
    }
    expect(checker.getCorrectionsForMisspelling("hello\0garbage")).toEqual([]);
    expect(checker.isMisspelled("hello")).toBe(false);
    expect(checker.checkSpelling("hello qzzzz")).toEqual([{ start: 6, end: 11 }]);
  });

  it("serializes queued checks with repeated dictionary and user-word changes", async () => {
    const checker = createChecker();
    const pending = [];
    const text = "hello qzzzz résumé";
    const expected = [{ start: 6, end: 11 }];
    for (let iteration = 0; iteration < 64; iteration++) {
      pending.push(checker.checkSpellingAsync(text));
      expect(checker.setDictionary(iteration % 2 ? "utf8" : "latin1", directory)).toBe(true);
      checker.add("éclairzz");
      expect(checker.isMisspelled("éclairzz")).toBe(false);
      checker.remove("éclairzz");
      expect(checker.getCorrectionsForMisspelling("cafe")).toContain("café");
    }
    for (const result of await Promise.all(pending)) expect(result).toEqual(expected);
    expect(checker.checkSpelling(text)).toEqual(expected);
  });
});
