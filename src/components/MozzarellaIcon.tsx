interface MozzarellaIconProps {
  size?: number;
  className?: string;
}

export function MozzarellaIcon({ size = 56, className }: MozzarellaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mozzarella"
    >
      {/* Soft shadow */}
      <ellipse cx="52" cy="54" rx="34" ry="33" fill="rgba(0,0,0,0.12)" />
      {/* Main mozzarella ball */}
      <circle cx="50" cy="50" r="33" fill="#FCF7E6" />
      {/* Highlight (top-left) */}
      <ellipse cx="38" cy="36" rx="18" ry="14" fill="#FFFCF0" opacity="0.7" />
      {/* Edge */}
      <circle cx="50" cy="50" r="33" stroke="#F0E6C8" strokeWidth="1.5" fill="none" />
      {/* Mozzarella holes */}
      <circle cx="38" cy="40" r="3.5" fill="#DCE3C9" />
      <circle cx="38" cy="40" r="2" fill="#EEF4DC" opacity="0.8" />
      <circle cx="60" cy="44" r="2.5" fill="#DCE3C9" />
      <circle cx="60" cy="44" r="1.2" fill="#EEF4DC" opacity="0.8" />
      <circle cx="48" cy="62" r="4" fill="#DCE3C9" />
      <circle cx="48" cy="62" r="2.3" fill="#EEF4DC" opacity="0.8" />
      <circle cx="66" cy="64" r="2.5" fill="#DCE3C9" />
      <circle cx="66" cy="64" r="1.2" fill="#EEF4DC" opacity="0.8" />
      <circle cx="32" cy="56" r="2" fill="#DCE3C9" />
      <circle cx="32" cy="56" r="1" fill="#EEF4DC" opacity="0.8" />
    </svg>
  );
}