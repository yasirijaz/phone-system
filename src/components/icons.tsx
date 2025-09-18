
export const Logo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 40"
      width="100"
      height="40"
      {...props}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: 'rgb(128,0,128)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'rgb(0,0,255)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path
        d="M 5 20 Q 15 5, 25 20 T 45 20"
        stroke="url(#logo-gradient)"
        fill="transparent"
        strokeWidth="2"
      />
      <circle cx="35" cy="10" r="4" fill="url(#logo-gradient)" />
      <path d="M 31 15 L 35 20 L 39 15" stroke="url(#logo-gradient)" fill="transparent" strokeWidth="1.5" />
    </svg>
  );

    