#include <vector>
#include <string>
#include <cstring>
#include <climits>

#include <windows.h>
#include <stdlib.h>
#include "transcoder.h"

namespace spellchecker {

struct Transcoder {
  UINT from_code_page;
  UINT to_code_page;
};

// Pulled from csutil.cxx.
void toAsciiLowerAndRemoveNonAlphanumeric(const char* pName, char* pBuf)
{
    while ( *pName )
    {
        /* A-Z */
        if ( (*pName >= 0x41) && (*pName <= 0x5A) )
        {
            *pBuf = (*pName)+0x20;  /* toAsciiLower */
            pBuf++;
        }
        /* a-z, 0-9 */
        else if ( ((*pName >= 0x61) && (*pName <= 0x7A)) ||
                  ((*pName >= 0x30) && (*pName <= 0x39)) )
        {
            *pBuf = *pName;
            pBuf++;
        }

        pName++;
    }

    *pBuf = '\0';
}

UINT GetCodePage(const char *dictionary_encoding) {
  // Convert into a normalized form. We have to do this because humans are so
  // inconsistent with their encoding lines and we want to make this as
  // tolerant as possible.
  std::vector<char> encoding_buffer(strlen(dictionary_encoding) + 1);
  char *encoding = encoding_buffer.data();
  toAsciiLowerAndRemoveNonAlphanumeric(dictionary_encoding, encoding);

  // The translation of code pages comes from:
  // https://docs.microsoft.com/en-us/windows/desktop/intl/code-page-identifiers
  if (!_stricmp(encoding, "utf8")) {
    return CP_UTF8;
  }

  if (!_stricmp(encoding, "iso88591")) {
    return 28591;
  }

  if (!_stricmp(encoding, "iso88592")) {
    return 28592;
  }

  if (!_stricmp(encoding, "iso88593")) {
    return 28593;
  }

  if (!_stricmp(encoding, "iso88594")) {
    return 28594;
  }

  if (!_stricmp(encoding, "iso88595")) {
    return 28595;
  }

  if (!_stricmp(encoding, "iso88596")) {
    return 28596;
  }

  if (!_stricmp(encoding, "iso88597")) {
    return 28597;
  }

  if (!_stricmp(encoding, "iso88598")) {
    return 28598;
  }

  if (!_stricmp(encoding, "iso88599")) {
    return 28599;
  }

  if (!_stricmp(encoding, "iso885910")) {
    return 28600;
  }

  if (!_stricmp(encoding, "iso885911") ||
      !_stricmp(encoding, "tis620")) {
    return 28601;
  }

  if (!_stricmp(encoding, "iso885913")) {
    return 28603;
  }

  if (!_stricmp(encoding, "iso885914")) {
    return 28604;
  }

  if (!_stricmp(encoding, "iso885915")) {
    return 28605;
  }

  if (!_stricmp(encoding, "koi8r") ||
      !_stricmp(encoding, "koi8u")) {
    return 20866;
  }

  if (!_stricmp(encoding, "cp1251") ||
      !_stricmp(encoding, "microsoftcp1251")) {
    return 1251;
  }

  if (!_stricmp(encoding, "xisciide") ||
      !_stricmp(encoding, "xisciias") ||
      !_stricmp(encoding, "isciidevangari")) {
    return 57002;
  }

  return static_cast<UINT>(-1);
}

Transcoder* NewUTF16ToUTF8Transcoder() {
  return new Transcoder();
}

Transcoder* NewTranscoder8to8(const char *from_encoding, const char *to_encoding) {
  const UINT from_code_page = GetCodePage(from_encoding);
  const UINT to_code_page = GetCodePage(to_encoding);
  if (from_code_page == static_cast<UINT>(-1) ||
      to_code_page == static_cast<UINT>(-1) ||
      !IsValidCodePage(from_code_page) || !IsValidCodePage(to_code_page)) {
    return NULL;
  }

  Transcoder *result = new Transcoder();
  result->from_code_page = from_code_page;
  result->to_code_page = to_code_page;
  return result;
}

void FreeTranscoder(Transcoder *transcoder) {
  delete transcoder;
}

bool TranscodeUTF16ToUTF8(const Transcoder *transcoder, char *out, size_t out_length, const uint16_t *in, size_t in_length) {
  if (!out || out_length == 0) return false;
  out[0] = '\0';
  if (in_length == 0) return true;
  if (!in || out_length == 1 || in_length > INT_MAX || out_length - 1 > INT_MAX) return false;

  const int length = WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, reinterpret_cast<const wchar_t *>(in),
      static_cast<int>(in_length), out, static_cast<int>(out_length - 1), NULL, NULL);
  if (length == 0) {
    out[0] = '\0';
    return false;
  }
  out[length] = '\0';
  return true;
}

bool Transcode8to8(const Transcoder *transcoder, char *out, size_t out_length, const char *in, size_t in_length) {
  if (!out || out_length == 0) return false;
  out[0] = '\0';
  if (in_length == 0) return true;
  if (!in || out_length == 1) return false;

  // A missing transcoder denotes a dictionary that already uses UTF-8.
  if (!transcoder) {
    if (in_length >= out_length) return false;
    std::memcpy(out, in, in_length);
    out[in_length] = '\0';
    return true;
  }

  if (in_length > INT_MAX || out_length - 1 > INT_MAX) return false;

  // Query the intermediate size instead of assuming that every input fits in
  // 256 UTF-16 code units. Suggestions can exceed the input word limit.
  const DWORD from_flags = transcoder->from_code_page == CP_UTF8 ? MB_ERR_INVALID_CHARS : 0;
  const int utf16_length = MultiByteToWideChar(
      transcoder->from_code_page, from_flags, in, static_cast<int>(in_length), NULL, 0);
  if (utf16_length == 0) return false;

  std::vector<wchar_t> utf16_buffer(utf16_length);
  if (MultiByteToWideChar(transcoder->from_code_page, from_flags, in,
                         static_cast<int>(in_length), utf16_buffer.data(), utf16_length) == 0) {
    return false;
  }

  const bool to_utf8 = transcoder->to_code_page == CP_UTF8;
  // ISCII (57002) requires zero flags; the other supported legacy code pages
  // can reject best-fit substitutions as well as default-character loss.
  const DWORD to_flags = to_utf8 ? WC_ERR_INVALID_CHARS :
      (transcoder->to_code_page == 57002 ? 0 : WC_NO_BEST_FIT_CHARS);
  BOOL used_default = FALSE;
  const int length = WideCharToMultiByte(
      transcoder->to_code_page, to_flags, utf16_buffer.data(), utf16_length,
      out, static_cast<int>(out_length - 1), NULL, to_utf8 ? NULL : &used_default);
  if (length == 0 || used_default) {
    out[0] = '\0';
    return false;
  }

  out[length] = '\0';
  return true;
}

}  // namespace spellchecker
