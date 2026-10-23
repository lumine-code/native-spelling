# native-spelling

Provides native system and Hunspell dictionary bindings.

Fork of [pulsar-edit/node-spellchecker](https://github.com/pulsar-edit/node-spellchecker).

The library uses the platform spelling API on macOS and Windows, with bundled Hunspell support as a portable fallback. The native addon is implemented with Node-API for ABI stability.

## Features

- **System dictionaries**: uses NSSpellChecker on macOS and the Windows Spell Check API.
- **Hunspell fallback**: loads bundled or user-selected Hunspell dictionaries on every platform.
- **Synchronous checks**: checks words or complete strings and returns UTF-16 ranges.
- **Asynchronous checks**: checks complete strings without blocking the main JavaScript thread.
- **Dictionary control**: switches languages and adds or removes session words.

## Installation

```sh
npm install @lumine-code/native-spelling
```

The package builds from source during installation and requires a C++20 toolchain supported by Node.js.

## Bundled sources

The portable backend uses [Hunspell 1.7.5](https://github.com/hunspell/hunspell/releases/tag/v1.7.5) and the standard American English dictionary from [SCOWL 2026.02.25](https://github.com/en-wl/wordlist/releases/tag/rel-2026.02.25). The engine and the matched `en_US.aff`/`en_US.dic` pair are vendored separately; their revisions and SHA-256 checksums are recorded in `vendor/sources.json`. The older dictionaries under `spec/dictionaries` remain test fixtures for legacy encodings and behavior.

Run `npm run build`, `npm test`, and `npm run test:memory` after changing the bundled sources. The standalone memory harness checks the native backend with AddressSanitizer; on Linux it also enables UndefinedBehaviorSanitizer and leak detection. It requires a compiler with sanitizer support, including the C++ AddressSanitizer component on Windows.

## Usage

```js
const spellchecker = require("@lumine-code/native-spelling");

async function main() {
  spellchecker.setDictionary("en_US", spellchecker.getDictionaryPath());
  console.log(spellchecker.isMisspelled("worrd"));
  console.log(await spellchecker.checkSpellingAsync("hello worrd"));
}

main();
```

Create an isolated checker when separate dictionaries or custom words are needed:

```js
const checker = new spellchecker.Spellchecker();
checker.setSpellcheckerType(spellchecker.ALWAYS_USE_HUNSPELL);
checker.setDictionary("en_US", spellchecker.getDictionaryPath());
```

The public methods are `setDictionary`, `isMisspelled`, `checkSpelling`, `checkSpellingAsync`, `getCorrectionsForMisspelling`, `getAvailableDictionaries`, `add`, and `remove`.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
