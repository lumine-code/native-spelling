# native-spelling

Provides native system and Hunspell dictionary bindings.

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

The package builds from source during installation and requires a C++17 toolchain supported by Node.js.

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
