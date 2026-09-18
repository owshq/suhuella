type SuhuellaLogoProps = {
  className?: string
}

export function SuhuellaLogo({ className = 'h-5 w-5' }: SuhuellaLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M15.2 15.2L20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.8 10.8h2.2l0.6 0.9h2.9v2.8H7.8V10.8z" fill="currentColor" fillOpacity="0.9" />
      <path d="M7.8 10.8l0.9-0.75h1.6l0.4 0.75" fill="currentColor" fillOpacity="0.55" />
    </svg>
  )
}
