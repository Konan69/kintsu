import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "@kintsu/backend/convex/_generated/api";
import { useState } from "react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const createUser = useMutation(api.users.create);
  const [isCreating, setIsCreating] = useState(false);
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null);

  const handleSelect = async (style: "anxious" | "avoidant") => {
    setIsCreating(true);
    try {
      const userId = await createUser({ attachmentStyle: style });
      localStorage.setItem("kintsu_user_id", userId);
      navigate({ to: "/chat" });
    } catch (error) {
      console.error("Failed to create user:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-6 py-12">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Soft gradient orbs */}
        <div
          className="absolute -left-40 top-1/4 h-[400px] w-[400px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, var(--sage-light) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute -right-40 bottom-1/4 h-[400px] w-[400px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, var(--terracotta-light) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(var(--foreground) 1px, transparent 1px),
              linear-gradient(90deg, var(--foreground) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
            Step 1 of 1
          </div>

          <h1 className="font-serif text-4xl font-light leading-tight tracking-tight text-foreground md:text-5xl">
            How do you experience
            <span className="relative mx-2 inline-block">
              <span className="text-terracotta">connection</span>
              <svg
                className="absolute -bottom-1 left-0 w-full"
                height="6"
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 3 Q25 6 50 3 T100 3"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            ?
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Understanding your attachment style helps Kintsu provide more
            personalized guidance. There's no right or wrong—just your unique
            way of relating.
          </p>
        </div>

        {/* Attachment Style Cards */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Anxious Attachment Card */}
          <button
            disabled={isCreating}
            onClick={() => handleSelect("anxious")}
            onMouseEnter={() => setHoveredStyle("anxious")}
            onMouseLeave={() => setHoveredStyle(null)}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 text-left backdrop-blur-sm transition-all duration-500 hover:border-terracotta/40 hover:shadow-2xl hover:shadow-terracotta/10 disabled:pointer-events-none disabled:opacity-50 md:p-10"
          >
            {/* Decorative corner accent */}
            <div
              className="absolute -right-20 -top-20 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle, var(--terracotta-light) 0%, transparent 70%)",
              }}
            />

            {/* Icon */}
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-terracotta/10 transition-transform duration-500 group-hover:scale-110">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                className="text-terracotta"
              >
                {/* Heart with waves */}
                <path
                  d="M14 24s-9-5.5-9-12c0-3.5 2.5-6 6-6 2 0 3.5 1 3 2.5-.5 1.5.5 2.5 0 3.5s1.5 2.5 0 3.5c-1 1 0 3 0 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M14 24s9-5.5 9-12c0-3.5-2.5-6-6-6-2 0-3.5 1-3 2.5.5 1.5-.5 2.5 0 3.5s-1.5 2.5 0 3.5c1 1 0 3 0 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Radiating lines for "seeking" */}
                <path
                  d="M14 4V2M8 6L6.5 4.5M20 6l1.5-1.5"
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="opacity-60"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="mb-2 font-serif text-2xl text-foreground transition-colors group-hover:text-terracotta">
              Anxious Attachment
            </h2>

            {/* Subtitle */}
            <p className="mb-6 text-muted-foreground">
              You feel deeply and seek reassurance in relationships
            </p>

            {/* Traits */}
            <ul className="space-y-3">
              {[
                { text: "Need reassurance from your partner", color: "terracotta" },
                { text: "Fear of abandonment or rejection", color: "gold" },
                { text: "Highly attuned to partner's moods", color: "sage" },
                { text: "May engage in 'protest behaviors'", color: "terracotta" },
              ].map((trait, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--${trait.color})` }}
                  />
                  {trait.text}
                </li>
              ))}
            </ul>

            {/* Hover indicator */}
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-terracotta opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>Choose this style</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:translate-x-1"
              >
                <path
                  d="M3 8h10m0 0L9 4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Selection ring */}
            <div
              className={`absolute inset-0 rounded-3xl border-2 transition-opacity duration-300 ${
                hoveredStyle === "anxious"
                  ? "border-terracotta opacity-100"
                  : "border-transparent opacity-0"
              }`}
            />
          </button>

          {/* Avoidant Attachment Card */}
          <button
            disabled={isCreating}
            onClick={() => handleSelect("avoidant")}
            onMouseEnter={() => setHoveredStyle("avoidant")}
            onMouseLeave={() => setHoveredStyle(null)}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 text-left backdrop-blur-sm transition-all duration-500 hover:border-sage/40 hover:shadow-2xl hover:shadow-sage/10 disabled:pointer-events-none disabled:opacity-50 md:p-10"
          >
            {/* Decorative corner accent */}
            <div
              className="absolute -right-20 -top-20 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle, var(--sage-light) 0%, transparent 70%)",
              }}
            />

            {/* Icon */}
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/20 transition-transform duration-500 group-hover:scale-110">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                className="text-sage"
              >
                {/* Mountain/fortress - independence symbol */}
                <path
                  d="M4 22L14 6l10 16H4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Inner peace circle */}
                <circle
                  cx="14"
                  cy="15"
                  r="3"
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  fill="none"
                  className="opacity-60"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="mb-2 font-serif text-2xl text-foreground transition-colors group-hover:text-sage">
              Avoidant Attachment
            </h2>

            {/* Subtitle */}
            <p className="mb-6 text-muted-foreground">
              You value independence and need space to feel secure
            </p>

            {/* Traits */}
            <ul className="space-y-3">
              {[
                { text: "Need space and autonomy", color: "sage" },
                { text: "May shut down during conflicts", color: "gold" },
                { text: "Uncomfortable with too much closeness", color: "terracotta" },
                { text: "Tend to suppress emotions", color: "sage" },
              ].map((trait, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--${trait.color})` }}
                  />
                  {trait.text}
                </li>
              ))}
            </ul>

            {/* Hover indicator */}
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-sage opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>Choose this style</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:translate-x-1"
              >
                <path
                  d="M3 8h10m0 0L9 4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Selection ring */}
            <div
              className={`absolute inset-0 rounded-3xl border-2 transition-opacity duration-300 ${
                hoveredStyle === "avoidant"
                  ? "border-sage opacity-100"
                  : "border-transparent opacity-0"
              }`}
            />
          </button>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="mx-auto max-w-lg text-sm text-muted-foreground/80">
            Don't worry if you're not sure—attachment styles exist on a
            spectrum, and Kintsu will help you understand your patterns over
            time.
          </p>

          {/* Kintsugi decorative element */}
          <div className="mx-auto mt-8 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="8"
                stroke="var(--border)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M8 12L12 8M12 16L16 12"
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
          </div>
        </div>
      </div>
    </div>
  );
}
