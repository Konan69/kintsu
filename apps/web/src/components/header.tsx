import { Link, useLocation } from "@tanstack/react-router";

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="relative z-50">
      <div className="flex flex-row items-center justify-between px-6 py-4 md:px-10 md:py-6">
        <Link
          to="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          {/* Kintsugi bowl icon */}
          <div className="relative">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="text-terracotta"
            >
              {/* Bowl shape */}
              <path
                d="M4 12C4 12 6 24 16 24C26 24 28 12 28 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all"
              />
              {/* Gold crack lines */}
              <path
                d="M12 12L14 18M16 10L16 20M20 12L18 18"
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="opacity-80"
              />
              {/* Rim */}
              <ellipse
                cx="16"
                cy="12"
                rx="12"
                ry="3"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>

          <span className="font-serif text-2xl tracking-wide text-foreground">
            Kintsu
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          {!isHome && (
            <Link
              to="/chat"
              className="group relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Conversations</span>
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
