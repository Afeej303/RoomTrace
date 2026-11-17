export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 22a11 11 0 0 1 16 0"
        className="stroke-primary-foreground"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity=".45"
      />
      <path
        d="M11 19a7 7 0 0 1 10 0"
        className="stroke-primary-foreground"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity=".75"
      />
      <circle cx="16" cy="12" r="2.5" className="fill-primary-foreground" />
    </svg>
  );
}
