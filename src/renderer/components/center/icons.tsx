// Small inline stroke icons for the center panels. 16px viewBox, stroke
// currentColor, strokeWidth 1.5 — per the app-wide icon rules. No emoji,
// no icon fonts.

interface IconProps {
  size?: number;
  className?: string;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
    focusable: false,
  };
}

export function IconRefresh({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M15 2.7v4h-4" />
      <path d="M13.66 10A6 6 0 1 1 12.25 3.76L15 6.7" />
    </svg>
  );
}

export function IconSunrise({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M11.5 12a3.5 3.5 0 0 0-7 0" />
      <path d="M2 12h12" />
      <path d="M8 2.5V7" />
      <path d="M5.75 4.75 8 2.5l2.25 2.25" />
    </svg>
  );
}

export function IconMoon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53z" />
    </svg>
  );
}

export function IconNews({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="2.5" y="3.5" width="11" height="9.5" rx="1.5" />
      <path d="M5 6.5h6" />
      <path d="M5 9h6" />
      <path d="M5 11h3.5" />
    </svg>
  );
}

export function IconCalendar({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" />
      <path d="M2.5 6.5h11" />
      <path d="M5.5 1.5v3" />
      <path d="M10.5 1.5v3" />
    </svg>
  );
}

export function IconAlert({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5.25v3.25" />
      <path d="M8 11h.01" />
    </svg>
  );
}
