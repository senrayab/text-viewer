import { useState } from 'react'
import type { PendingGroup, Work } from '../lib/library'

interface AddDialogProps {
  groups: PendingGroup[]
  works: Work[]
  onCancel: () => void
  onConfirm: (groups: PendingGroup[]) => void
}

/** 서재에 담기 전에 파일 묶음마다 어느 작품으로 담을지 확인한다 */
export function AddDialog({ groups: initial, works, onCancel, onConfirm }: AddDialogProps) {
  const [groups, setGroups] = useState(initial)
  const fileCount = groups.reduce((n, g) => n + g.files.length, 0)

  const update = (index: number, changes: Partial<PendingGroup>) =>
    setGroups((list) => list.map((g, i) => (i === index ? { ...g, ...changes } : g)))

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-label="서재에 담기">
        <header className="panel-head">
          <h2>서재에 담기</h2>
          <p>
            {fileCount}개 파일 · {groups.length}개 작품
          </p>
        </header>

        <div className="groups">
          {groups.map((g, i) => {
            const first = g.files[0].parsed.label
            const last = g.files[g.files.length - 1].parsed.label
            return (
              <div key={i} className="card group">
                <p className="group-files">{g.files.length === 1 ? first : `${g.files.length}편 · ${first} ~ ${last}`}</p>
                <select className="text-input" value={g.target} onChange={(e) => update(i, { target: e.target.value })}>
                  <option value="new">새 작품으로 담기</option>
                  {works.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}에 추가
                    </option>
                  ))}
                </select>
                {g.target === 'new' && (
                  <input
                    className="text-input"
                    value={g.title}
                    placeholder="작품 이름"
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            취소
          </button>
          <button className="primary" onClick={() => onConfirm(groups)}>
            담기
          </button>
        </div>
      </div>
    </div>
  )
}
