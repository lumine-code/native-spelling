var ALWAYS_USE_HUNSPELL,
  Spellchecker,
  deDE,
  defaultLanguage,
  dictionaryDirectory,
  enUS,
  frFR,
  i,
  invalidLength1Byte,
  invalidLength1BytePair,
  invalidLength2Byte,
  invalidLength2BytePair,
  invalidLength3Byte,
  invalidLength3BytePair,
  invalidLength4Byte,
  invalidLength4BytePair,
  len,
  maximumLength1Byte,
  maximumLength1BytePair,
  maximumLength2Byte,
  maximumLength2BytePair,
  maximumLength3Byte,
  maximumLength3BytePair,
  maximumLength4Byte,
  path,
  ref,
  spellIndex,
  spellType,
  testAlwaysUseHunspell;

({ Spellchecker, ALWAYS_USE_HUNSPELL } = require("../lib/spellchecker"));

path = require("path");

enUS = "A robot is a mechanical or virtual artificial agent, usually an electronic machine";

deDE =
  "Ein Roboter ist eine technische Apparatur, die üblicherweise dazu dient, dem Menschen mechanische Arbeit abzunehmen.";

frFR = "Les robots les plus évolués sont capables de se déplacer et de se recharger par eux-mêmes";

defaultLanguage = "en_US";

dictionaryDirectory = path.join(__dirname, "dictionaries");

// Because we are dealing with C++ and buffers, we want
// to make sure the user doesn't pass in a string that
// causes a buffer overrun. We limit our buffers to
// 256 characters (64-character word in UTF-8).
maximumLength1Byte = "a".repeat(256);

maximumLength2Byte = "ö".repeat(128);

maximumLength3Byte = "ऐ".repeat(85);

maximumLength4Byte = "𐅐".repeat(64);

invalidLength1Byte = maximumLength1Byte + "a";

invalidLength2Byte = maximumLength2Byte + "ö";

invalidLength3Byte = maximumLength3Byte + "ऐ";

invalidLength4Byte = maximumLength4Byte + "𐄇";

maximumLength1BytePair = [maximumLength1Byte, maximumLength1Byte].join(" ");

maximumLength2BytePair = [maximumLength2Byte, maximumLength2Byte].join(" ");

maximumLength3BytePair = [maximumLength3Byte, maximumLength3Byte].join(" ");

invalidLength1BytePair = [invalidLength1Byte, invalidLength1Byte].join(" ");

invalidLength2BytePair = [invalidLength2Byte, invalidLength2Byte].join(" ");

invalidLength3BytePair = [invalidLength3Byte, invalidLength3Byte].join(" ");

invalidLength4BytePair = [invalidLength4Byte, invalidLength4Byte].join(" ");

spellType = null;

spellIndex = null;

ref = [true, false];
for (i = 0, len = ref.length; i < len; i++) {
  testAlwaysUseHunspell = ref[i];
  ((testAlwaysUseHunspell) => {
    var buildSpellChecker;
    describe(`SpellChecker (${testAlwaysUseHunspell ? "Hunspell" : "platform default"})`, function () {
      describe(".setDictionary", function () {
        beforeEach(function () {
          return (this.fixture = buildSpellChecker());
        });
        it("returns true for en_US", function () {
          return this.fixture.setDictionary("en_US", dictionaryDirectory);
        });
        it("returns true for de_DE_frami", function () {
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          return this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
        });
        it("returns true for de_DE", function () {
          return this.fixture.setDictionary("en_US", dictionaryDirectory);
        });
        return it("returns true for fr", function () {
          return this.fixture.setDictionary("fr", dictionaryDirectory);
        });
      });
      describe(".isMisspelled(word)", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        it("returns true if the word is mispelled", function () {
          this.fixture.setDictionary("en_US", dictionaryDirectory);
          return expect(this.fixture.isMisspelled("wwoorrddd")).toBe(true);
        });
        it("returns false if the word is not mispelled: word", function () {
          this.fixture.setDictionary("en_US", dictionaryDirectory);
          return expect(this.fixture.isMisspelled("word")).toBe(false);
        });
        it("returns false if the word is not mispelled: cheese", function () {
          this.fixture.setDictionary("en_US", dictionaryDirectory);
          return expect(this.fixture.isMisspelled("cheese")).toBe(false);
        });
        it("returns true if Latin German word is misspelled with ISO8859-1 file", function () {
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("Kine")).toBe(true);
        });
        it("returns true if Latin German word is misspelled with UTF-8 file", function () {
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("Kine")).toBe(true);
        });
        it("returns false if Latin German word is not misspelled with ISO8859-1 file", function () {
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("Nacht")).toBe(false);
        });
        it("returns false if Latin German word is not misspelled with UTF-8 file", function () {
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("Nacht")).toBe(false);
        });
        it("returns true if Unicode German word is misspelled with ISO8859-1 file", function () {
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("möchtzn")).toBe(true);
        });
        it("returns true if Unicode German word is misspelled with UTF-8 file", function () {
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("möchtzn")).toBe(true);
        });
        it("returns false if Unicode German word is not misspelled with ISO8859-1 file", function () {
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("vermöchten")).toBe(false);
        });
        it("returns false if Unicode German word is not misspelled with UTF-8 file", function () {
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          return expect(this.fixture.isMisspelled("vermöchten")).toBe(false);
        });
        it("throws an exception when no word specified", function () {
          return expect(function () {
            return this.fixture.isMisspelled();
          }).toThrow();
        });
        it("returns true for a string of 256 1-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(maximumLength1Byte)).toBe(true);
          }
        });
        it("returns true for a string of 128 2-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(maximumLength2Byte)).toBe(true);
          }
        });
        it("returns true for a string of 85 3-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(maximumLength3Byte)).toBe(true);
          }
        });
        it("returns true for a string of 64 4-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(maximumLength4Byte)).toBe(true);
          }
        });
        it("returns false for a string of 257 1-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(invalidLength1Byte)).toBe(false);
          }
        });
        it("returns false for a string of 65 2-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(invalidLength2Byte)).toBe(false);
          }
        });
        it("returns false for a string of 86 3-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(invalidLength3Byte)).toBe(false);
          }
        });
        return it("returns false for a string of 65 4-byte characters", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.isMisspelled(invalidLength4Byte)).toBe(false);
          }
        });
      });
      describe(".checkSpelling(string)", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        it("automatically detects languages on OS X", function () {
          if (process.platform !== "darwin" || spellType === "hunspell") {
            return;
          }
          expect(this.fixture.checkSpelling(enUS)).toEqual([]);
          expect(this.fixture.checkSpelling(deDE)).toEqual([]);
          return expect(this.fixture.checkSpelling(frFR)).toEqual([]);
        });
        it("correctly switches languages", function () {
          expect(this.fixture.setDictionary("en_US", dictionaryDirectory)).toBe(true);
          expect(this.fixture.checkSpelling(enUS)).toEqual([]);
          expect(this.fixture.checkSpelling(deDE)).not.toEqual([]);
          expect(this.fixture.checkSpelling(frFR)).not.toEqual([]);
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType === "hunspell") {
            if (this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)) {
              expect(this.fixture.checkSpelling(enUS)).not.toEqual([]);
              expect(this.fixture.checkSpelling(deDE)).toEqual([]);
              expect(this.fixture.checkSpelling(frFR)).not.toEqual([]);
            }
          }
          if (this.fixture.setDictionary("de_DE", dictionaryDirectory)) {
            expect(this.fixture.checkSpelling(enUS)).not.toEqual([]);
            expect(this.fixture.checkSpelling(deDE)).toEqual([]);
            expect(this.fixture.checkSpelling(frFR)).not.toEqual([]);
          }
          this.fixture = buildSpellChecker();
          if (this.fixture.setDictionary("fr_FR", dictionaryDirectory)) {
            expect(this.fixture.checkSpelling(enUS)).not.toEqual([]);
            expect(this.fixture.checkSpelling(deDE)).not.toEqual([]);
            return expect(this.fixture.checkSpelling(frFR)).toEqual([]);
          }
        });
        it("returns an array of character ranges of misspelled words", function () {
          var string;
          string = "cat caat dog dooog";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 4,
              end: 8,
            },
            {
              start: 13,
              end: 18,
            },
          ]);
        });
        it("returns an array of character ranges of misspelled German words with ISO8859-1 file", function () {
          var string;
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          string = "Kein Kine vermöchten möchtzn";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 5,
              end: 9,
            },
            {
              start: 21,
              end: 28,
            },
          ]);
        });
        it("returns an array of character ranges of misspelled German words with UTF-8 file", function () {
          var string;
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          string = "Kein Kine vermöchten möchtzn";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 5,
              end: 9,
            },
            {
              start: 21,
              end: 28,
            },
          ]);
        });
        it("returns an array of character ranges of misspelled French words", function () {
          var string;
          expect(this.fixture.setDictionary("fr", dictionaryDirectory)).toBe(true);
          string = "Française Françoize";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 10,
              end: 19,
            },
          ]);
        });
        it("accounts for UTF16 pairs", function () {
          var string;
          string = "😎 cat caat dog dooog";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 7,
              end: 11,
            },
            {
              start: 16,
              end: 21,
            },
          ]);
        });
        it("accounts for other non-word characters", function () {
          var string;
          string = "'cat' (caat. <dog> :dooog)";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: 7,
              end: 11,
            },
            {
              start: 20,
              end: 25,
            },
          ]);
        });
        it("does not treat non-english letters as word boundaries", function () {
          this.fixture.add("cliché");
          expect(this.fixture.checkSpelling("what cliché nonsense")).toEqual([]);
          return this.fixture.remove("cliché");
        });
        it("handles words with apostrophes", function () {
          var string;
          string = "doesn't isn't aint hasn't";
          expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: string.indexOf("aint"),
              end: string.indexOf("aint") + 4,
            },
          ]);
          string = "you say you're 'certain', but are you really?";
          expect(this.fixture.checkSpelling(string)).toEqual([]);
          string = "you say you're 'sertan', but are you really?";
          return expect(this.fixture.checkSpelling(string)).toEqual([
            {
              start: string.indexOf("sertan"),
              end: string.indexOf("',"),
            },
          ]);
        });
        it("handles invalid inputs", function () {
          var fixture;
          fixture = this.fixture;
          expect(fixture.checkSpelling("")).toEqual([]);
          expect(function () {
            return fixture.checkSpelling();
          }).toThrowError(TypeError, "Bad argument");
          expect(function () {
            return fixture.checkSpelling(null);
          }).toThrowError(TypeError, "Bad argument");
          return expect(function () {
            return fixture.checkSpelling({});
          }).toThrowError(TypeError, "Bad argument");
        });
        it("returns values for a pair of 256 1-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(maximumLength1BytePair)).toEqual([
              {
                start: 0,
                end: 256,
              },
              {
                start: 257,
                end: 513,
              },
            ]);
          }
        });
        it("returns values for a string of 128 2-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(maximumLength2BytePair)).toEqual([
              {
                start: 0,
                end: 128,
              },
              {
                start: 129,
                end: 257,
              },
            ]);
          }
        });
        it("returns values for a string of 85 3-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(maximumLength3BytePair)).toEqual([
              {
                start: 0,
                end: 85,
              },
              {
                start: 86,
                end: 171,
              },
            ]);
          }
        });
        it("returns nothing for a pair of 257 1-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(invalidLength1BytePair)).toEqual([]);
          }
        });
        it("returns nothing for a pair of 129 2-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(invalidLength2BytePair)).toEqual([]);
          }
        });
        it("returns nothing for a pair of 86 3-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(invalidLength3BytePair)).toEqual([]);
          }
        });
        it("returns nothing for a pair of 65 4-byte character strings", function () {
          if (process.platform === "linux") {
            return expect(this.fixture.checkSpelling(invalidLength4BytePair)).toEqual([]);
          }
        });
        it("returns values for a pair of 256 1-byte character strings with encoding", function () {
          if (process.platform === "linux") {
            // de_DE_frami is invalid outside of Hunspell dictionaries.
            if (spellType !== "hunspell") {
              return;
            }
            this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
            return expect(this.fixture.checkSpelling(maximumLength1BytePair)).toEqual([
              {
                start: 0,
                end: 256,
              },
              {
                start: 257,
                end: 513,
              },
            ]);
          }
        });
        it("returns values for a string of 128 2-byte character strings with encoding", function () {
          if (process.platform === "linux") {
            // de_DE_frami is invalid outside of Hunspell dictionaries.
            if (spellType !== "hunspell") {
              return;
            }
            this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
            return expect(this.fixture.checkSpelling(maximumLength2BytePair)).toEqual([
              {
                start: 0,
                end: 128,
              },
              {
                start: 129,
                end: 257,
              },
            ]);
          }
        });
        it("returns values for a string of 85 3-byte character strings with encoding", function () {
          if (process.platform === "linux") {
            // de_DE_frami is invalid outside of Hunspell dictionaries.
            if (spellType !== "hunspell") {
              return;
            }
            this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
            return this.fixture.checkSpelling(invalidLength3BytePair);
          }
        });
        it("returns nothing for a pair of 257 1-byte character strings with encoding", function () {
          if (process.platform === !"linux") {
            // de_DE_frami is invalid outside of Hunspell dictionaries.
            if (spellType !== "hunspell") {
              return;
            }
            this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
            return expect(this.fixture.checkSpelling(maximumLength2BytePair)).toEqual([]);
          }
        });
        it("returns nothing for a pair of 129 2-byte character strings with encoding", function () {
          if (process.platform === !"linux") {
            return;
          }
          // We are only testing for allocation errors.
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
          return this.fixture.checkSpelling(invalidLength2BytePair);
        });
        it("returns nothing for a pair of 86 3-byte character strings with encoding", function () {
          if (process.platform === !"linux") {
            return;
          }
          // We are only testing for allocation errors.
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
          return this.fixture.checkSpelling(invalidLength3BytePair);
        });
        return it("returns nothing for a pair of 65 4-byte character strings with encoding", function () {
          if (process.platform === !"linux") {
            return;
          }
          // We are only testing for allocation errors.
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          this.fixture.setDictionary("de_DE_frami", dictionaryDirectory);
          return this.fixture.checkSpelling(invalidLength4BytePair);
        });
      });
      describe(".checkSpellingAsync(string)", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        it("returns an array of character ranges of misspelled words", async function () {
          const string = "cat caat dog dooog";
          const ranges = await this.fixture.checkSpellingAsync(string);
          expect(ranges).toEqual([
            {
              start: 4,
              end: 8,
            },
            {
              start: 13,
              end: 18,
            },
          ]);
        });
        return it("handles invalid inputs", function () {
          expect(() => {
            return this.fixture.checkSpelling();
          }).toThrowError(TypeError, "Bad argument");
          expect(() => {
            return this.fixture.checkSpelling(null);
          }).toThrowError(TypeError, "Bad argument");
          return expect(() => {
            return this.fixture.checkSpelling(47);
          }).toThrowError(TypeError, "Bad argument");
        });
      });
      describe(".getCorrectionsForMisspelling(word)", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        it("returns an array of possible corrections", function () {
          var correction, corrections;
          correction = ["word", "world", "word"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("worrd");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("throws an exception when no word specified", function () {
          return expect(function () {
            return this.fixture.getCorrectionsForMisspelling();
          }).toThrow();
        });
        it("returns an array of possible corrections for a correct English word", function () {
          var correction, corrections;
          expect(this.fixture.isMisspelled("cheese")).toBe(false);
          correction = ["cheeses", "chaise", "cheesy"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("cheese");
          expect(corrections.length).toBeGreaterThan(0);
          expect(corrections).toContain(correction);
          return expect(this.fixture.isMisspelled(correction)).toBe(false);
        });
        it("returns an array of possible corrections for a correct Latin German word with ISO8859-1 file", function () {
          var correction, corrections;
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          correction = ["Acht", "Macht", "Acht"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Nacht");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("returns an array of possible corrections for a correct Latin German word with UTF-8 file", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          correction = ["Acht", "Macht", "Acht"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Nacht");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("returns an array of possible corrections for a incorrect Latin German word with ISO8859-1 file", function () {
          var correction, corrections;
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          correction = ["Acht", "Nicht", "Acht"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Nacht");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("returns an array of possible corrections for a incorrect Latin German word with UTF-8 file", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          correction = ["Acht", "SEE BELOW", "Acht"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Nacht");
          expect(corrections.length).toBeGreaterThan(0);
          if (spellType === "mac") {
            // For some reason, the CI build will produce inconsistent results on
            // the Mac based on some external factor.
            return expect(corrections[0] === "Nicht" || corrections[0] === "Macht").toEqual(true);
          } else {
            return expect(corrections[0]).toEqual(correction);
          }
        });
        it("returns an array of possible corrections for correct Unicode German word with ISO8859-1 file", function () {
          var correction, corrections;
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          expect(this.fixture.isMisspelled("vermöchten")).toBe(false);
          correction = ["vermöchte", "vermochten", "vermochte"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("vermöchten");
          expect(corrections.length).toBeGreaterThan(0);
          expect(corrections).toContain(correction);
          return expect(this.fixture.isMisspelled(correction)).toBe(false);
        });
        it("returns an array of possible corrections for correct Unicode German word with UTF-8 file", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          expect(this.fixture.isMisspelled("vermöchten")).toBe(false);
          correction = ["vermöchte", "vermochten", "vermochte"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("vermöchten");
          expect(corrections.length).toBeGreaterThan(0);
          expect(corrections).toContain(correction);
          return expect(this.fixture.isMisspelled(correction)).toBe(false);
        });
        it("returns an array of possible corrections for incorrect Unicode German word with ISO8859-1 file", function () {
          var correction, corrections;
          // de_DE_frami is invalid outside of Hunspell dictionaries.
          if (spellType !== "hunspell") {
            return;
          }
          expect(this.fixture.setDictionary("de_DE_frami", dictionaryDirectory)).toBe(true);
          correction = ["möchten", "möchten", "möchten"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("möchtzn");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("returns an array of possible corrections for incorrect Unicode German word with UTF-8 file", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("de_DE", dictionaryDirectory)).toBe(true);
          correction = ["möchten", "möchten", "möchten"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("möchtzn");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        it("returns an array of possible corrections for correct Unicode French word", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("fr", dictionaryDirectory)).toBe(true);
          correction = ["Françoise", "Françoise", "française"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Française");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
        return it("returns an array of possible corrections for incorrect Unicode French word", function () {
          var correction, corrections;
          expect(this.fixture.setDictionary("fr", dictionaryDirectory)).toBe(true);
          correction = ["Françoise", "Françoise", "Françoise"][spellIndex];
          corrections = this.fixture.getCorrectionsForMisspelling("Françoize");
          expect(corrections.length).toBeGreaterThan(0);
          return expect(corrections[0]).toEqual(correction);
        });
      });
      describe(".add(word) and .remove(word)", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        it("allows words to be added and removed to the dictionary", function () {
          // NB: Windows spellchecker cannot remove words, and since it holds onto
          // words, rerunning this test >1 time causes it to incorrectly fail
          if (process.platform === "win32") {
            return;
          }
          expect(this.fixture.isMisspelled("wwoorrdd")).toBe(true);
          this.fixture.add("wwoorrdd");
          expect(this.fixture.isMisspelled("wwoorrdd")).toBe(false);
          this.fixture.remove("wwoorrdd");
          return expect(this.fixture.isMisspelled("wwoorrdd")).toBe(true);
        });
        it("add throws an error if no word is specified", function () {
          var errorOccurred;
          errorOccurred = false;
          try {
            this.fixture.add();
          } catch {
            errorOccurred = true;
          }
          return expect(errorOccurred).toBe(true);
        });
        return it("remove throws an error if no word is specified", function () {
          var errorOccurred;
          errorOccurred = false;
          try {
            this.fixture.remove();
          } catch {
            errorOccurred = true;
          }
          return expect(errorOccurred).toBe(true);
        });
      });
      describe(".getAvailableDictionaries()", function () {
        beforeEach(function () {
          this.fixture = buildSpellChecker();
          return this.fixture.setDictionary(defaultLanguage, dictionaryDirectory);
        });
        return it("returns an array of string dictionary names", function () {
          var dictionaries, dictionary;
          // NB: getAvailableDictionaries is nop'ped in hunspell and it also doesn't
          // work inside Appveyor's CI environment
          if (spellType === "hunspell" || process.env.CI) {
            return;
          }
          dictionaries = this.fixture.getAvailableDictionaries();
          expect(Array.isArray(dictionaries)).toBe(true);
          expect(dictionaries.length).toBeGreaterThan(0);
          for (dictionary of dictionaries) {
            expect(typeof dictionary).toBe("string");
            expect(dictionary.length).toBeGreaterThan(0);
          }
        });
      });
      return describe(".setDictionary(lang, dictDirectory)", function () {
        return it("sets the spell checkers language, and dictionary directory", function () {
          var awesome;
          awesome = true;
          return expect(awesome).toBe(true);
        });
      });
    });
    buildSpellChecker = function () {
      var checker;
      checker = new Spellchecker();
      if (testAlwaysUseHunspell) {
        checker.setSpellcheckerType(ALWAYS_USE_HUNSPELL);
        spellType = "hunspell";
        spellIndex = 0;
      } else {
        // We can get different results based on using Hunspell, Mac, or Windows
        // checkers. To simplify the rules, we create a variable that contains
        // 'hunspell', 'mac', or 'win' for filtering. We also create an index variable
        // to go into arrays.
        if (process.env.SPELLCHECKER_PREFER_HUNSPELL) {
          spellType = "hunspell";
          spellIndex = 0;
        } else if (process.platform === "darwin") {
          spellType = "mac";
          spellIndex = 1;
        } else if (process.platform === "win32") {
          spellType = "win";
          spellIndex = 2;
        } else {
          spellType = "hunspell";
          spellIndex = 0;
        }
      }
      return checker;
    };
  })(testAlwaysUseHunspell);
}
