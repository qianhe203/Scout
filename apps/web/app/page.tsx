import { BriefForm } from "../components/BriefForm";
import { SiteHeader } from "../components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <header className="hero">
          <p className="hero-eyebrow">Your creator discovery partner</p>
          <h1 className="hero-title">
            <span className="hero-line">Find the right</span>
            <span className="hero-line">
              <span className="hero-accent">creators</span> with confidence
            </span>
          </h1>
          <p className="hero-lead">
            Result-driven AI research, discovery, and outreach — with harness
            guardrails that enforce budget, quality, and brand safety.
          </p>
        </header>
        <BriefForm />
      </main>
    </>
  );
}
