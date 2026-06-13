export function ScoutIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="brand-icon"
    >
      <defs>
        <radialGradient id="scout-icon-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(77, 144, 150)" />
          <stop offset="100%" stopColor="rgb(58, 118, 124)" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#scout-icon-grad)" />
      <circle cx="16" cy="16" r="10" stroke="#ffffff" strokeWidth="1.5" opacity="0.35" />
      <circle cx="16" cy="16" r="6" stroke="#ffffff" strokeWidth="1.5" opacity="0.65" />
      <circle cx="16" cy="16" r="2.5" fill="#ffffff" />
      <path
        d="M16 16 L16 6 A10 10 0 0 1 24.5 11.5 Z"
        fill="#ffffff"
        opacity="0.22"
      />
      <path
        d="M16 16 L24 16"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}
