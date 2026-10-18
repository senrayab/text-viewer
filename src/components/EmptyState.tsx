const SHORTCUTS: [string, string][] = [
  ['Ctrl O', '파일 열기'],
  ['Ctrl F', '검색'],
  ['Ctrl G', '줄 이동'],
  ['F', '집중 모드'],
  ['T', '테마 전환'],
  ['+ / −', '글자 크기'],
  ['L', '줄 번호'],
  ['W', '자동 줄바꿈'],
]

export function EmptyState({ onOpen, error }: { onOpen: () => void; error: string | null }) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="drop-zone">
          <h1>텍스트 파일을 열어보세요</h1>
          <p>.txt 파일을 이곳에 끌어다 놓거나</p>
          <button className="primary" onClick={onOpen}>
            파일 선택
          </button>
          <p className="note">UTF-8 · EUC-KR · UTF-16 인코딩 자동 감지</p>
          {error && <p className="error">{error}</p>}
        </div>
        <dl className="shortcuts">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key}>
              <dt>
                <kbd>{key}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
