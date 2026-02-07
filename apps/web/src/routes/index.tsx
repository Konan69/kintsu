import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("kintsu_user_id");
    if (userId) {
      navigate({ to: "/chat" });
    }
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 100);
  }, [navigate]);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large organic blob - top right */}
        <div
          className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--gold-light), var(--sage-light) 60%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Small accent blob - bottom left */}
        <div
          className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle at 70% 70%, var(--terracotta-light), var(--gold-light) 50%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Subtle floating golden cracks - decorative SVG */}
        <svg
          className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
          viewBox="0 0 800 800"
          fill="none"
        >
          <path
            d="M200 400 Q350 380 400 400 T600 400"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M400 200 Q380 350 400 400 T400 600"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M250 250 Q350 350 400 400 T550 550"
            stroke="var(--gold)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M550 250 Q450 350 400 400 T250 550"
            stroke="var(--gold)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Main content */}
      <div
        className={`relative z-10 max-w-2xl text-center transition-all duration-1000 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* Kintsugi Bowl Icon */}
        <div className="mx-auto mb-10 flex justify-center">
          <div className="relative">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              className="animate-float"
            >
              {/* Outer glow */}
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Bowl base shadow */}
              <ellipse
                cx="60"
                cy="95"
                rx="35"
                ry="8"
                fill="var(--foreground)"
                opacity="0.05"
              />

              {/* Bowl shape */}
              <path
                d="M15 45C15 45 22 90 60 90C98 90 105 45 105 45"
                stroke="var(--terracotta)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />

              {/* Bowl rim */}
              <ellipse
                cx="60"
                cy="45"
                rx="45"
                ry="12"
                stroke="var(--terracotta)"
                strokeWidth="3"
                fill="var(--cream)"
              />

              {/* Golden kintsugi cracks */}
              <g filter="url(#glow)">
                <path
                  d="M40 45L48 70"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M60 33L60 80"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M80 45L72 70"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M35 50L50 55"
                  stroke="var(--gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M85 50L70 55"
                  stroke="var(--gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>

              {/* Small decorative circles at crack junctions */}
              <circle cx="48" cy="70" r="2" fill="var(--gold)" />
              <circle cx="60" cy="80" r="2" fill="var(--gold)" />
              <circle cx="72" cy="70" r="2" fill="var(--gold)" />
            </svg>

            {/* Subtle shimmer effect */}
            <div className="absolute inset-0 animate-shimmer rounded-full opacity-30" />
          </div>
        </div>

        {/* Main heading */}
        <h1
          className={`font-serif text-5xl font-light leading-tight tracking-tight text-foreground transition-all delay-200 duration-1000 md:text-6xl lg:text-7xl ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          Mend with
          <span className="relative ml-3 inline-block">
            <span className="relative z-10 text-terracotta">gold</span>
            <svg
              className="absolute -bottom-2 left-0 w-full"
              height="8"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
            >
              <path
                d="M0 4 Q25 8 50 4 T100 4"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Tagline */}
        <p
          className={`mx-auto mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground transition-all delay-300 duration-1000 md:text-xl ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          Like kintsugi—the Japanese art of repairing pottery with gold—Kintsu
          helps you embrace your patterns and grow stronger in your
          relationships.
        </p>

        {/* Feature pills */}
        <div
          className={`mt-10 flex flex-wrap justify-center gap-3 transition-all delay-400 duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {["Understand your patterns", "Communicate better", "Grow together"].map(
            (feature, i) => (
              <span
                key={feature}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition-all hover:border-gold/40 hover:bg-card"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background:
                      i === 0
                        ? "var(--terracotta)"
                        : i === 1
                          ? "var(--gold)"
                          : "var(--sage)",
                  }}
                />
                {feature}
              </span>
            )
          )}
        </div>

        {/* CTA Button */}
        <div
          className={`mt-12 transition-all delay-500 duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <Button
            size="lg"
            onClick={() => navigate({ to: "/onboarding" })}
            className="group relative overflow-hidden rounded-full bg-terracotta px-10 py-6 text-base font-medium text-primary-foreground shadow-lg shadow-terracotta/20 transition-all hover:bg-terracotta/90 hover:shadow-xl hover:shadow-terracotta/30"
          >
            <span className="relative z-10 flex items-center gap-2">
              Begin your journey
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="transition-transform group-hover:translate-x-1"
              >
                <path
                  d="M4 10h12m0 0l-4-4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Button>
        </div>

        {/* Subtle helper text */}
        <p
          className={`mt-6 text-sm text-muted-foreground/70 transition-all delay-600 duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          Free to start • No account required
        </p>
      </div>

      {/* Bottom decorative wave */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0">
        <svg
          className="w-full text-muted/30"
          height="120"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60 Q360 120 720 60 T1440 60 V120 H0 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}
