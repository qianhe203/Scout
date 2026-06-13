import { BriefForm } from "../components/BriefForm";

export default function HomePage() {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Scout</p>
          <h1>Creator discovery harness</h1>
          <p className="muted">
          Scout is an AI-powered digital marketing agency managed by a harness that enforces budget, quality, and brand-safety constraints.
          </p>
        </div>
      </header>
      <BriefForm />
    </main>
  );
}
