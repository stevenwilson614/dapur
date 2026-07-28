interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export type IconName =
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "check"
  | "clock"
  | "camera"
  | "link"
  | "note"
  | "book"
  | "cart"
  | "calendar"
  | "x"
  | "trash"
  | "pencil"
  | "search"
  | "pot"
  | "eye"
  | "share"
  | "settings"
  | "clipboard";

/** Feather-style wire icons. Stroke inherits currentColor. */
const PATHS: Record<IconName, JSX.Element> = {
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-left": <path d="M15 18l-6-6 6-6" />,
  "chevron-right": <path d="M9 18l6-6-6-6" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 014.5 7h2.2a1 1 0 00.83-.45l.94-1.4A1 1 0 019.3 4.7h5.4a1 1 0 01.83.45l.94 1.4a1 1 0 00.83.45h2.2A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.2 1.1" />
      <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.2-1.1" />
    </>
  ),
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M19 15h-5v5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 016.5 18H19v3H6.5A1.5 1.5 0 015 19.5z" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 001.5 1.2h7.9a1.5 1.5 0 001.5-1.1L20 7H6" />
      <circle cx="9.5" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L20 8a2.8 2.8 0 00-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  pot: (
    <>
      <path d="M4 9h16v6a4 4 0 01-4 4H8a4 4 0 01-4-4z" />
      <path d="M2 9h20M8 6V4M12 6V4M16 6V4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 10h6M9 14h4" />
    </>
  ),
};

export default function Icon({ name, className = "", size = 20 }: IconProps) {
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
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
