#include <algorithm>
#include <atomic>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "spellchecker_hunspell.h"
#include "transcoder.h"

namespace {

using spellchecker::HunspellSpellchecker;
using spellchecker::Transcoder;
using TranscoderPointer = std::unique_ptr<Transcoder, decltype(&spellchecker::FreeTranscoder)>;

void Require(bool condition, const char* message) {
  if (!condition) throw std::runtime_error(message);
}

TranscoderPointer TranscoderFor(const char* source, const char* destination) {
  return TranscoderPointer(spellchecker::NewTranscoder8to8(source, destination),
                           spellchecker::FreeTranscoder);
}

bool Contains(const std::vector<std::string>& values, const std::string& value) {
  return std::find(values.begin(), values.end(), value) != values.end();
}

std::string Repeat(const std::string& text, size_t count) {
  std::string result;
  result.reserve(text.size() * count);
  for (size_t i = 0; i < count; ++i) result += text;
  return result;
}

std::vector<uint16_t> Corpus(const std::u16string& text) {
  std::vector<uint16_t> corpus(text.begin(), text.end());
  corpus.push_back(0);
  return corpus;
}

void Write(const std::filesystem::path& path, const std::string& contents) {
  std::ofstream stream(path, std::ios::binary);
  stream.write(contents.data(), static_cast<std::streamsize>(contents.size()));
  Require(stream.good(), "Cannot create the isolated test dictionaries");
}

void WriteDictionaries(const std::filesystem::path& directory) {
  std::filesystem::create_directories(directory);
  Write(directory / "utf8.aff",
        "SET UTF-8\nTRY abcdefghijklmnopqrstuvwxyz\nREP 2\nREP worrd word\n"
        "REP möchtzn möchten\n");
  Write(directory / "utf8.dic", "5\ncat\nword\nmöchten\ncafé\nżółw\n");
  const std::string acute = Repeat("\xe9", 90);
  const std::string umlautO = Repeat("\xf6", 90);
  const std::string umlautU = Repeat("\xfc", 90);
  Write(directory / "latin.aff",
        "SET ISO8859-1\nTRY abcdefghijklmnopqrstuvwxyz\nREP 3\nREP worrd word\n"
        "REP m\xf6" "chtzn m\xf6" "chten\nREP longtypo " +
            acute + "_" + umlautO + "_" + umlautU + "\n");
  Write(directory / "latin.dic", "7\ncat\nword\nm\xf6" "chten\ncaf\xe9\n" +
                                     acute + "\n" + umlautO + "\n" + umlautU + "\n");
}

void CheckTranscoders() {
  using spellchecker::Transcode8to8;
  using spellchecker::TranscodeUTF16ToUTF8;

  // Allocate the exact capacities so ASan sees a write to the terminator slot.
  for (const size_t size : {size_t{0}, size_t{1}, size_t{255}, size_t{256}, size_t{257}, size_t{4096}}) {
    const std::string input(size, 'x');
    std::vector<char> exact(size);
    Require(!Transcode8to8(nullptr, exact.data(), exact.size(), input.data(), input.size()),
            "An output buffer without room for NUL must fail");
    std::vector<char> sufficient(size + 1);
    Require(Transcode8to8(nullptr, sufficient.data(), sufficient.size(), input.data(), input.size()),
            "A passthrough buffer including NUL must succeed");
    Require(std::string(sufficient.data()) == input, "Passthrough altered the input");
  }

  Require(!Transcode8to8(nullptr, nullptr, 0, "word", 4), "Null output must fail");
  char output[16] = {};
  Require(!Transcode8to8(nullptr, output, sizeof(output), nullptr, 1), "Null input must fail");

  TranscoderPointer utf16(spellchecker::NewUTF16ToUTF8Transcoder(), spellchecker::FreeTranscoder);
  Require(utf16 != nullptr, "Cannot create the UTF-16 transcoder");
  const auto text = Corpus(u"éé");
  std::vector<char> narrow(4);
  Require(!TranscodeUTF16ToUTF8(utf16.get(), narrow.data(), narrow.size(), text.data(), 2),
          "UTF-16 output must reserve its terminator");
  std::vector<char> complete(5);
  Require(TranscodeUTF16ToUTF8(utf16.get(), complete.data(), complete.size(), text.data(), 2),
          "UTF-16 conversion must fit its exact capacity including NUL");
  Require(std::string(complete.data()) == "éé", "UTF-16 conversion damaged accented text");

  const uint16_t invalid[] = {0xd800};
  Require(!TranscodeUTF16ToUTF8(utf16.get(), output, sizeof(output), invalid, 1),
          "An unpaired surrogate must fail conversion");

  auto toLatin = TranscoderFor("UTF-8", "ISO8859-1");
  auto fromLatin = TranscoderFor("ISO8859-1", "UTF-8");
  Require(toLatin != nullptr && fromLatin != nullptr, "Cannot create legacy transcoders");
  Require(Transcode8to8(toLatin.get(), output, sizeof(output), "café", 5),
          "UTF-8 to legacy conversion failed");
  Require(std::string(output) == "caf\xe9", "Legacy dictionary encoding is incorrect");
  Require(Transcode8to8(fromLatin.get(), output, sizeof(output), "caf\xe9", 4),
          "Legacy to UTF-8 conversion failed");
  Require(std::string(output) == "café", "Legacy result lost Unicode");
  Require(!Transcode8to8(toLatin.get(), output, sizeof(output), "żółw", 7),
          "Unrepresentable Unicode must fail without substitution");
  const char malformed[] = {static_cast<char>(0xc3), '('};
  Require(!Transcode8to8(toLatin.get(), output, sizeof(output), malformed, sizeof(malformed)),
          "Malformed UTF-8 must fail conversion");
  Require(!TranscoderFor("UTF-8", "not-a-real-encoding"), "Unknown dictionary encoding must fail");
}

void CheckLifetimes(const std::string& directory) {
  const auto corpus = Corpus(u"😎 cat caat café");
  const std::vector<std::string> boundaryInputs = {
      std::string(255, 'a'), std::string(256, 'a'), std::string(257, 'a'),
      std::string(4096, 'a'), std::string(1024 * 1024, 'a'),
      Repeat("ö", 128), Repeat("ö", 129), Repeat("ऐ", 85), Repeat("ऐ", 86),
      Repeat("𐅐", 64), Repeat("𐅐", 65), std::string(128, '\xc3')};

  for (size_t iteration = 0; iteration < 40; ++iteration) {
    HunspellSpellchecker checker;
    for (const char* dictionary : {"utf8", "latin"}) {
      Require(checker.SetDictionary(dictionary, directory), "Cannot load a test dictionary");
      Require(!checker.IsMisspelled("möchten"), "Accented dictionary word was rejected");
      Require(checker.IsMisspelled("möchtzn"), "Misspelling was accepted");

      const auto retained = checker.GetCorrectionsForMisspelling("möchtzn");
      Require(Contains(retained, "möchten"), "Unicode suggestion was lost");
      for (size_t suggestion = 0; suggestion < 20; ++suggestion) {
        Require(Contains(checker.GetCorrectionsForMisspelling("worrd"), "word"),
                "Repeated suggestion call failed");
      }
      Require(Contains(retained, "möchten"), "An earlier suggestion lost its owned storage");
      if (std::string(dictionary) == "latin") {
        const std::string expanded = Repeat("é", 90) + " " + Repeat("ö", 90) + " " + Repeat("ü", 90);
        Require(Contains(checker.GetCorrectionsForMisspelling("longtypo"), expanded),
                "A legacy suggestion expanding beyond the fixed buffer was truncated");
      }

      const auto ranges = checker.CheckSpelling(corpus.data(), corpus.size());
      Require(ranges.size() == 1 && ranges[0].start == 7 && ranges[0].end == 11,
              "UTF-16 ranges changed around a surrogate pair");

      Require(checker.IsMisspelled("cafézz"), "Custom word unexpectedly exists");
      checker.Add("cafézz");
      Require(!checker.IsMisspelled("cafézz"), "Unicode custom word was not added");
      checker.Remove("cafézz");
      Require(checker.IsMisspelled("cafézz"), "Unicode custom word was not removed");

      for (const auto& input : boundaryInputs) {
        checker.IsMisspelled(input);
        checker.GetCorrectionsForMisspelling(input);
        checker.Add(input);
        checker.Remove(input);
      }
      for (const char16_t character : {u'a', u'ö', u'ऐ'}) {
        const auto boundary = Corpus(std::u16string(256, character));
        checker.CheckSpelling(boundary.data(), boundary.size());
      }
    }
    Require(!checker.SetDictionary("missing", directory), "Missing dictionary must fail");
    checker.GetCorrectionsForMisspelling("worrd");
    checker.CheckSpelling(corpus.data(), corpus.size());
  }
}

void CheckConcurrentAccess(const std::string& directory) {
  HunspellSpellchecker checker;
  Require(checker.SetDictionary("utf8", directory), "Cannot load the concurrent dictionary");
  const auto corpus = Corpus(u"cat caat word");
  std::atomic<bool> valid{true};
  std::vector<std::thread> threads;
  for (size_t worker = 0; worker < 4; ++worker) {
    threads.emplace_back([&] {
      for (size_t iteration = 0; iteration < 50; ++iteration) {
        const auto ranges = checker.CheckSpelling(corpus.data(), corpus.size());
        if (ranges.size() != 1 || ranges[0].start != 4 || ranges[0].end != 8 ||
            !Contains(checker.GetCorrectionsForMisspelling("worrd"), "word")) {
          valid = false;
        }
      }
    });
  }
  for (size_t iteration = 0; iteration < 50; ++iteration) {
    if (!checker.SetDictionary(iteration % 2 ? "utf8" : "latin", directory)) valid = false;
    checker.Add("temporaryword");
    checker.Remove("temporaryword");
  }
  for (auto& thread : threads) thread.join();
  Require(valid, "Concurrent checks and dictionary mutations corrupted a result");
}

}  // namespace

int main(int argc, char** argv) {
  try {
    Require(argc == 2, "Usage: hunspell-memory <isolated-dictionary-directory>");
    WriteDictionaries(argv[1]);
    CheckTranscoders();
    CheckLifetimes(argv[1]);
    CheckConcurrentAccess(argv[1]);
    std::cout << "Passed transcoder boundaries, Unicode suggestions, dictionary lifetimes and concurrent access.\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
