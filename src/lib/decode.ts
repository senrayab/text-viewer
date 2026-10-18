export type Encoding = 'utf-8' | 'euc-kr' | 'utf-16le' | 'utf-16be' | 'shift_jis'
export type EncodingChoice = Encoding | 'auto'

export const ENCODINGS: { value: Encoding; label: string }[] = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'euc-kr', label: 'EUC-KR' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'shift_jis', label: 'Shift_JIS' },
]

/** BOM → UTF-16 널 바이트 패턴 → UTF-8 엄격 디코딩 순으로 판별하고, 모두 아니면 EUC-KR(CP949)로 본다. */
export function detectEncoding(buffer: ArrayBuffer): Encoding {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'

  const sample = bytes.subarray(0, 4096)
  const half = sample.length / 2
  if (half > 0) {
    let evenNull = 0
    let oddNull = 0
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] !== 0) continue
      if (i % 2 === 0) evenNull++
      else oddNull++
    }
    if (oddNull / half > 0.3 && evenNull / half < 0.05) return 'utf-16le'
    if (evenNull / half > 0.3 && oddNull / half < 0.05) return 'utf-16be'
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return 'utf-8'
  } catch {
    return 'euc-kr'
  }
}

export function decode(buffer: ArrayBuffer, encoding: Encoding) {
  return new TextDecoder(encoding).decode(buffer)
}
