#include <cstring>
#include <iconv.h>
#include <stdint.h>
#include <stdlib.h>
#include <limits>
#include "transcoder.h"

namespace spellchecker {

struct Transcoder {
  iconv_t conversion;
};

static int IsBigEndian(void) {
  union {
    uint16_t integer;
    char bytes[2];
  } two_byte_value;

  two_byte_value.integer = {0x0102};
  return two_byte_value.bytes[0] == 1;
}

Transcoder *NewUTF16ToUTF8Transcoder() {
  const char *to_encoding = "UTF-8";
  const char *from_encoding = IsBigEndian() ? "UTF-16BE" : "UTF-16LE";
  iconv_t conversion = iconv_open(to_encoding, from_encoding);
  if (conversion == (iconv_t)-1) {
    return NULL;
  }

  Transcoder *result = new Transcoder();
  result->conversion = conversion;
  return result;
}

Transcoder *NewTranscoder8to8(const char *from_encoding, const char *to_encoding) {
  iconv_t conversion = iconv_open(to_encoding, from_encoding);
  
  if (conversion == (iconv_t)-1) {
    return NULL;
  }

  Transcoder *result = new Transcoder();
  result->conversion = conversion;
  return result;
}

void FreeTranscoder(Transcoder *transcoder) {
  if (!transcoder) return;
  iconv_close(transcoder->conversion);
  delete transcoder;
}

bool TranscodeUTF16ToUTF8(const Transcoder *transcoder, char *out, size_t out_bytes, const uint16_t *in, size_t in_length) {
  if (!out || out_bytes == 0) return false;
  out[0] = '\0';
  if (in_length == 0) return true;
  if (!transcoder || !in || in_length > std::numeric_limits<size_t>::max() / sizeof(uint16_t)) {
    return false;
  }

  char *const output_start = out;
  // iconv does not terminate its output. Keep that byte outside its capacity.
  --out_bytes;
  char *utf16_word = reinterpret_cast<char *>(const_cast<uint16_t *>(in));
  size_t utf16_bytes = in_length * (sizeof(uint16_t) / sizeof(char));

  iconv(transcoder->conversion, NULL, NULL, NULL, NULL);
  size_t iconv_result = iconv(
    transcoder->conversion,
    &utf16_word,
    &utf16_bytes,
    &out,
    &out_bytes
  );

  if (iconv_result == static_cast<size_t>(-1) || utf16_bytes != 0) {
    output_start[0] = '\0';
    return false;
  }

  if (iconv(transcoder->conversion, NULL, NULL, &out, &out_bytes) == static_cast<size_t>(-1)) {
    output_start[0] = '\0';
    return false;
  }
  *out = '\0';
  return true;
}

bool Transcode8to8(const Transcoder *transcoder, char *out, size_t out_length, const char *in, size_t in_length) {
  if (!out || out_length == 0) return false;
  out[0] = '\0';
  if (in_length == 0) return true;
  if (!in) return false;

  char *utf8_word = reinterpret_cast<char *>(const_cast<char *>(in));

  if (!transcoder) {
    if (in_length >= out_length) return false;
    std::memcpy(out, in, in_length);
    out[in_length] = '\0';
  } else {
    char *const output_start = out;
    --out_length;
    iconv(transcoder->conversion, NULL, NULL, NULL, NULL);
    size_t iconv_result = iconv(
      transcoder->conversion,
      &utf8_word,
      &in_length,
      &out,
      &out_length
    );

    if (iconv_result == static_cast<size_t>(-1) || in_length != 0) {
      output_start[0] = '\0';
      return false;
    }

    if (iconv(transcoder->conversion, NULL, NULL, &out, &out_length) == static_cast<size_t>(-1)) {
      output_start[0] = '\0';
      return false;
    }

    *out = '\0';
  }

  return true;
}

}  // namespace spellchecker
