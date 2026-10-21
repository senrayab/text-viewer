/** 파일을 읽으면서 읽은 양을 알려 준다. signal로 중간에 그만둘 수 있다 (그때는 null). */
export function readWithProgress(
  file: File,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => onProgress(e.loaded)
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onabort = () => resolve(null)
    reader.onerror = () => reject(reader.error)
    signal.addEventListener('abort', () => reader.abort(), { once: true })
    reader.readAsArrayBuffer(file)
  })
}
