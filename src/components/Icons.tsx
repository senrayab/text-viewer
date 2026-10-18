import type { ReactNode } from 'react'

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const OpenIcon = () => (
  <Icon>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
)

export const TypeIcon = () => (
  <Icon>
    <path d="M4 18 9 6l5 12M5.8 14h6.4" />
    <path d="M15.5 12.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 12v6" />
  </Icon>
)

export const FocusIcon = () => (
  <Icon>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </Icon>
)

export const CloseIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const UpIcon = () => (
  <Icon size={16}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
)

export const DownIcon = () => (
  <Icon size={16}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const MinusIcon = () => (
  <Icon size={16}>
    <path d="M6 12h12" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon size={16}>
    <path d="M6 12h12M12 6v12" />
  </Icon>
)
