import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Maximize,
  Minus,
  Plus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'

// 앱의 아이콘은 모두 Lucide(https://lucide.dev/icons/)를 쓰고, 크기와 굵기는 여기서 통일한다
const STROKE = 1.75

function icon(Component: LucideIcon, defaultSize: number) {
  return ({ size = defaultSize }: { size?: number }) => (
    <Component size={size} strokeWidth={STROKE} aria-hidden />
  )
}

export const OpenIcon = icon(FolderOpen, 18)
export const SearchIcon = icon(Search, 18)
export const TypeIcon = icon(CaseSensitive, 18)
export const FocusIcon = icon(Maximize, 18)
export const CloseIcon = icon(X, 18)
export const CaseIcon = icon(CaseSensitive, 18)
export const UpIcon = icon(ChevronUp, 16)
export const DownIcon = icon(ChevronDown, 16)
export const MinusIcon = icon(Minus, 16)
export const PlusIcon = icon(Plus, 16)
