#include <cstdio>
#include <cstring>
#include <cwctype>
#include <clocale>
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <locale.h>
#ifdef __APPLE__
#include <xlocale.h>
#endif
#include <memory>
#include <string>
#include "../vendor/hunspell/src/hunspell/hunspell.hxx"
#include "spellchecker_hunspell.h"
#include "buffers.h"

namespace spellchecker {

namespace {

// Classify Unicode without changing the process locale from worker threads.
class CharacterClassifier {
 public:
  CharacterClassifier() {
#ifdef _WIN32
    locale = _create_locale(LC_CTYPE, "en_US.UTF-8");
    if (!locale) locale = _create_locale(LC_CTYPE, "");
#else
    locale = newlocale(LC_CTYPE_MASK, "C.UTF-8", nullptr);
    if (!locale) locale = newlocale(LC_CTYPE_MASK, "en_US.UTF-8", nullptr);
    if (!locale) locale = newlocale(LC_CTYPE_MASK, "", nullptr);
#endif
  }
  ~CharacterClassifier() {
#ifdef _WIN32
    if (locale) _free_locale(locale);
#else
    if (locale) freelocale(locale);
#endif
  }
  bool Alpha(uint16_t c) const {
#ifdef _WIN32
    return locale ? _iswalpha_l(c, locale) != 0 : iswalpha(c) != 0;
#else
    return locale ? iswalpha_l(c, locale) != 0 : iswalpha(c) != 0;
#endif
  }
  bool Separator(uint16_t c) const {
#ifdef _WIN32
    return locale ? (_iswpunct_l(c, locale) || _iswspace_l(c, locale))
                  : (iswpunct(c) || iswspace(c));
#else
    return locale ? (iswpunct_l(c, locale) || iswspace_l(c, locale))
                  : (iswpunct(c) || iswspace(c));
#endif
  }
 private:
#ifdef _WIN32
  _locale_t locale;
#else
  locale_t locale;
#endif
};

std::filesystem::path Utf8Path(const std::string& path) {
#ifdef __cpp_char8_t
  return std::filesystem::path(std::u8string(path.begin(), path.end()));
#else
  return std::filesystem::u8path(path);
#endif
}

std::string DictionaryPath(const std::string& path) {
  std::error_code error;
  const auto absolute = std::filesystem::absolute(Utf8Path(path), error);
  if (error) return path;
  const auto utf8 = absolute.lexically_normal().u8string();
  std::string result(utf8.begin(), utf8.end());
#ifdef _WIN32
  // Hunspell's MSVC file opener recognizes UTF-8 through this prefix.
  if (result.compare(0, 4, "\\\\?\\") != 0) {
    result = result.compare(0, 2, "\\\\") == 0
        ? "\\\\?\\UNC\\" + result.substr(2) : "\\\\?\\" + result;
  }
#endif
  return result;
}

bool ReadableDictionaryFile(const std::string& path) {
  std::ifstream file(Utf8Path(path), std::ios::binary);
  return file.is_open();
}

// Remembers what `Hunspell::spell` said about a word for the rest of one check.
//
// Prose repeats itself steeply — a handful of words carry most of the
// occurrences — and the dictionary lookup is the bulk of a check's time, so
// most of that work is the same question asked again. A hash map would answer
// it, but it allocates a node per distinct word, and text where nothing repeats
// (a minified blob, a base64 payload) would pay that for no return.
//
// This is direct-mapped and stores its keys inline, so it never allocates per
// word and never grows: a colliding word evicts the previous occupant and costs
// one ordinary lookup. Words too long to store inline skip it, which by the same
// steep distribution are the ones least likely to repeat.
class WordVerdictCache {
 public:
  WordVerdictCache() : slots_(kSlotCount) {}

  const bool* Lookup(const char* word, size_t length) const {
    if (length >= kMaxWordLength) return NULL;
    const Slot& slot = slots_[Index(word, length)];
    if (!slot.occupied || slot.length != length) return NULL;
    if (memcmp(slot.word, word, length) != 0) return NULL;
    return &slot.misspelled;
  }

  void Store(const char* word, size_t length, bool misspelled) {
    if (length >= kMaxWordLength) return;
    Slot& slot = slots_[Index(word, length)];
    memcpy(slot.word, word, length);
    slot.length = static_cast<uint8_t>(length);
    slot.misspelled = misspelled;
    slot.occupied = true;
  }

 private:
  static const size_t kSlotCount = 4096;  // a power of two, so Index can mask
  static const size_t kMaxWordLength = 24;

  struct Slot {
    char word[kMaxWordLength];
    uint8_t length;
    bool misspelled;
    bool occupied;

    Slot() : length(0), misspelled(false), occupied(false) {}
  };

  static size_t Index(const char* word, size_t length) {
    // FNV-1a.
    uint32_t hash = 2166136261u;
    for (size_t i = 0; i < length; i++) {
      hash ^= static_cast<unsigned char>(word[i]);
      hash *= 16777619u;
    }
    return hash & (kSlotCount - 1);
  }

  std::vector<Slot> slots_;
};

}  // namespace

HunspellSpellchecker::HunspellSpellchecker() : hunspell(NULL), transcoder(NewUTF16ToUTF8Transcoder()), toDictionaryTranscoder(NULL), fromDictionaryTranscoder(NULL) { }

HunspellSpellchecker::~HunspellSpellchecker() {
  if (hunspell) {
    delete hunspell;
  }

  if (transcoder) {
    FreeTranscoder(transcoder);
  }

  if (toDictionaryTranscoder) {
    FreeTranscoder(toDictionaryTranscoder);
  }

  if (fromDictionaryTranscoder) {
    FreeTranscoder(fromDictionaryTranscoder);
  }
}

bool HunspellSpellchecker::SetDictionary(const std::string& language, const std::string& dirname) {
  std::lock_guard<std::mutex> lock(mutex);

  // NB: Hunspell uses underscore to separate language and locale, and Win8 uses
  // dash - if they use the wrong one, just silently replace it for them
  std::string lang = language;
  std::replace(lang.begin(), lang.end(), '-', '_');

  std::string affixpath = DictionaryPath(dirname + "/" + lang + ".aff");
  std::string dpath = DictionaryPath(dirname + "/" + lang + ".dic");

  if (!ReadableDictionaryFile(affixpath) || !ReadableDictionaryFile(dpath)) {
    return false;
  }

  // Create the hunspell object with our dictionary.
  std::unique_ptr<Hunspell> next(new Hunspell(affixpath.c_str(), dpath.c_str()));

  // Once we have the dictionary, then we check to see if we need
  // an internal conversion. This is needed because Hunspell has
  // two modes: in UTF-8 mode, everything is treated as a UTF-8
  // string which is what we have. Otherwise, it needs the specific
  // encoding of the file.
  std::string encoding = next->get_dic_encoding();
  bool isUTF8 = encoding.compare("UTF-8") == 0;

  Transcoder* toDictionary = nullptr;
  Transcoder* fromDictionary = nullptr;
  if (!isUTF8) {
    toDictionary = NewTranscoder8to8("UTF-8", encoding.c_str());
    fromDictionary = NewTranscoder8to8(encoding.c_str(), "UTF-8");
    if (!toDictionary || !fromDictionary) {
      if (toDictionary) FreeTranscoder(toDictionary);
      if (fromDictionary) FreeTranscoder(fromDictionary);
      return false;
    }
  }

  if (toDictionaryTranscoder) {
    FreeTranscoder(toDictionaryTranscoder);
    toDictionaryTranscoder = NULL;
  }

  if (fromDictionaryTranscoder) {
    FreeTranscoder(fromDictionaryTranscoder);
    fromDictionaryTranscoder = NULL;
  }

  delete hunspell;
  hunspell = next.release();
  toDictionaryTranscoder = toDictionary;
  fromDictionaryTranscoder = fromDictionary;

  // Return that we successfully created the components.
  return true;
}

std::vector<std::string> HunspellSpellchecker::GetAvailableDictionaries(const std::string& path) {
  return std::vector<std::string>();
}

bool HunspellSpellchecker::IsMisspelled(const std::string& word) {
  std::lock_guard<std::mutex> lock(mutex);
  if (!hunspell) {
    return false;
  }

  // If the word is too long, then don't do anything.
  if (word.length() > MAX_UTF8_BUFFER || word.find('\0') != std::string::npos) {
    return false;
  }

  // If we have a dictionary transcoder, then we need to transcode
  // the input into the encoding the dictionary requires.
  std::vector<char> dict_buffer(MAX_TRANSCODE_BUFFER);
  bool converted = Transcode8to8(toDictionaryTranscoder, dict_buffer.data(), dict_buffer.size(), word.data(), word.size());

  if (!converted) {
    return false;
  }

  // Process the call on the transcoded data.
  return !hunspell->spell(std::string(dict_buffer.data()));
}

std::vector<MisspelledRange> HunspellSpellchecker::CheckSpelling(const uint16_t *utf16_text, size_t utf16_length) {
  std::lock_guard<std::mutex> lock(mutex);
  std::vector<MisspelledRange> result;

  if (!hunspell || !transcoder) {
    return result;
  }

  std::vector<char> utf8_buffer(MAX_UTF16_TO_UTF8_BUFFER);

  // Reused by every word rather than allocated per word. A megabyte of prose is
  // upwards of a hundred thousand words, and this buffer is half a kilobyte.
  std::vector<char> dict_buffer(MAX_TRANSCODE_BUFFER);

  // The dictionary cannot change while this call is running, so a verdict is
  // good for the rest of it.
  WordVerdictCache seen;

  enum {
    unknown,
    in_separator,
    in_word,
  } state = in_separator;

  static const CharacterClassifier characters;

  // Go through the UTF-16 characters and look for breaks.
  for (size_t word_start = 0, i = 0; i < utf16_length; i++) {
    uint16_t c = utf16_text[i];

    switch (state) {
      case unknown:
        if (characters.Separator(c)) {
          state = in_separator;
        }
        break;

      case in_separator:
        if (characters.Alpha(c)) {
          word_start = i;
          state = in_word;
        } else if (!characters.Separator(c)) {
          state = unknown;
        }
        break;

      case in_word:
        if ((c == '\'' || c == 0x2019) && i + 1 < utf16_length && characters.Alpha(utf16_text[i + 1])) {
          i++;
        } else if (c == 0 || characters.Separator(c)) {
          state = in_separator;
          bool converted = TranscodeUTF16ToUTF8(transcoder, (char *)utf8_buffer.data(), utf8_buffer.size(), utf16_text + word_start, i - word_start);

          if (converted) {
            const size_t utf8_length = strlen(utf8_buffer.data());
            const char *word = utf8_buffer.data();

            // Convert into the dictionary's encoding, if it wants one that is
            // not UTF-8. Passing the buffer's capacity as the source length
            // rather than the word's would transcode the whole buffer for every
            // word.
            if (toDictionaryTranscoder) {
              converted = Transcode8to8(toDictionaryTranscoder, dict_buffer.data(), dict_buffer.size(), utf8_buffer.data(), utf8_length);
              word = dict_buffer.data();
            }

            if (converted) {
              // Pass in the dictionary-encoded text for spelling.
              const size_t word_length = toDictionaryTranscoder ? strlen(word) : utf8_length;
              const bool* cached = seen.Lookup(word, word_length);
              bool misspelled;

              if (cached) {
                misspelled = *cached;
              } else {
                misspelled = !hunspell->spell(std::string(word));
                seen.Store(word, word_length, misspelled);
              }

              if (misspelled) {
                MisspelledRange range;
                range.start = word_start;
                range.end = i;
                result.push_back(range);
              }
            }
          }
        } else if (!characters.Alpha(c)) {
          state = unknown;
        }
        break;
    }
  }

  return result;
}

void HunspellSpellchecker::Add(const std::string& word) {
  std::lock_guard<std::mutex> lock(mutex);
  if (hunspell && word.size() <= MAX_UTF8_BUFFER && word.find('\0') == std::string::npos) {
    std::vector<char> buffer(MAX_TRANSCODE_BUFFER);
    if (Transcode8to8(toDictionaryTranscoder, buffer.data(), buffer.size(), word.data(), word.size())) {
      hunspell->add(std::string(buffer.data()));
    }
  }
}

void HunspellSpellchecker::Remove(const std::string& word) {
  std::lock_guard<std::mutex> lock(mutex);
  if (hunspell && word.size() <= MAX_UTF8_BUFFER && word.find('\0') == std::string::npos) {
    std::vector<char> buffer(MAX_TRANSCODE_BUFFER);
    if (Transcode8to8(toDictionaryTranscoder, buffer.data(), buffer.size(), word.data(), word.size())) {
      hunspell->remove(std::string(buffer.data()));
    }
  }
}

std::vector<std::string> HunspellSpellchecker::GetCorrectionsForMisspelling(const std::string& word) {
  std::lock_guard<std::mutex> lock(mutex);
  std::vector<std::string> corrections;

  if (hunspell && word.size() <= MAX_UTF8_BUFFER && word.find('\0') == std::string::npos) {
    // Convert the buffer into a dictionary-specific encoding.
    std::vector<char> dict_buffer(MAX_TRANSCODE_BUFFER);
    bool converted = Transcode8to8(toDictionaryTranscoder, dict_buffer.data(), dict_buffer.size(), word.data(), word.size());

    if (converted) {
      // The C++ API owns suggestion storage, including on early returns.
      const auto suggestions = hunspell->suggest(std::string(dict_buffer.data()));
      corrections.reserve(suggestions.size());

      for (const auto& suggestion : suggestions) {
        // Suggestions are still in dictionary encoding. We need to
        // convert them back to UTF-8 so Chrome/V8 can play with them properly.
        if (!fromDictionaryTranscoder) {
          corrections.push_back(suggestion);
        } else {
          std::vector<char> output(suggestion.size() * 4 + 1);
          if (Transcode8to8(fromDictionaryTranscoder, output.data(), output.size(), suggestion.data(), suggestion.size())) {
            corrections.emplace_back(output.data());
          }
        }
      }
    }
  }

  return corrections;
}

}  // namespace spellchecker
