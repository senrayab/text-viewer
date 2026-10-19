import {
  ALargeSmall,
  ArrowDownUp,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  CaseSensitive,
  CircleCheck,
  CircleDashed,
  CircleDotDashed,
  CircleSmall,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cloud,
  CircleUserRound,
  Ellipsis,
  FolderOpen,
  History,
  ImageMinus,
  ImagePlus,
  Library,
  ListOrdered,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Search,
  Share,
  Smartphone,
  Trash2,
  UnfoldVertical,
  WrapText,
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
export const BackIcon = icon(ChevronLeft, 20)
export const SearchIcon = icon(Search, 18)
export const TypeIcon = icon(CaseSensitive, 18)
export const FocusIcon = icon(Maximize, 18)
export const CloseIcon = icon(X, 18)
export const CaseIcon = icon(CaseSensitive, 18)
export const RecentIcon = icon(History, 16)
export const UpIcon = icon(ChevronUp, 16)
export const DownIcon = icon(ChevronDown, 16)
export const MinusIcon = icon(Minus, 16)
export const PlusIcon = icon(Plus, 16)

// 설정 패널 항목 앞의 아이콘
export const FontSizeIcon = icon(ALargeSmall, 16)
export const LineHeightIcon = icon(UnfoldVertical, 16)
export const LineNumberIcon = icon(ListOrdered, 16)
export const WrapIcon = icon(WrapText, 16)

// 내 서재
export const LibraryIcon = icon(Library, 18)
export const SaveIcon = icon(BookmarkPlus, 18)
export const SavedIcon = icon(BookmarkCheck, 18)
export const MoreIcon = icon(Ellipsis, 16)
export const EditIcon = icon(Pencil, 16)
export const TrashIcon = icon(Trash2, 16)
export const CoverIcon = icon(ImagePlus, 16)
export const CoverRemoveIcon = icon(ImageMinus, 16)
export const NextIcon = icon(ChevronRight, 18)
export const BookIcon = icon(BookOpen, 18)
export const SortIcon = icon(ArrowDownUp, 14)

// 편 상태: 읽기 전 · 읽는 중 · 다 읽음 (읽을 차례인 편은 아이콘이 아니라 줄 강조로 보여준다)
export const UnreadIcon = icon(CircleDashed, 18)
export const ReadingIcon = icon(CircleDotDashed, 18)
export const DoneIcon = icon(CircleCheck, 18)

/** 서재에서 최근에 읽은 작품 표시 — 선 대신 채운 작은 점 */
export const RecentDotIcon = () => <CircleSmall size={12} strokeWidth={0} fill="currentColor" aria-hidden />
export const PhoneIcon = icon(Smartphone, 18)
export const ShareIcon = icon(Share, 14)

// 백업
export const CloudIcon = icon(Cloud, 16)
export const AccountIcon = icon(CircleUserRound, 16)
export const ChevronIcon = icon(ChevronRight, 16)
