#ifndef SRC_SPELLCHECKER_HUNSPELL_H_
#define SRC_SPELLCHECKER_HUNSPELL_H_

#include "spellchecker.h"
#include "transcoder.h"
#include <mutex>

class Hunspell;

namespace spellchecker {

class HunspellSpellchecker : public SpellcheckerImplementation {
public:
  HunspellSpellchecker();
  ~HunspellSpellchecker();

  bool SetDictionary(const std::string& language, const std::string& path);
  std::vector<std::string> GetAvailableDictionaries(const std::string& path);
  std::vector<std::string> GetCorrectionsForMisspelling(const std::string& word);
  bool IsMisspelled(const std::string& word);
  std::vector<MisspelledRange> CheckSpelling(const uint16_t *text, size_t length);
  void Add(const std::string& word);
  void Remove(const std::string& word);

private:
  // Workers and the JavaScript thread share one dictionary and its converters.
  std::mutex mutex;
  Hunspell* hunspell;
  Transcoder *transcoder;
  Transcoder *toDictionaryTranscoder;
  Transcoder *fromDictionaryTranscoder;
};

}  // namespace spellchecker

#endif  // SRC_SPELLCHECKER_HUNSPELL_H_
