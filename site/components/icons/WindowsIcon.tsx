type IconProps = {
  className?: string;
};

export function WindowsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3 5.5L10.5 4.1V11.5H3V5.5ZM10.5 12.6H3V19.9L10.5 18.5V12.6ZM11.6 4L21 2.1V11.5H11.6V4ZM21 12.6H11.6V19.9L21 18V12.6Z" />
    </svg>
  );
}
