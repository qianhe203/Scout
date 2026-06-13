import { BriefForm } from "../components/BriefForm";

export default function HomePage() {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Scout</p>
          <h1>Creator discovery harness</h1>
          <p className="muted">
            Workers do tasks. The harness enforces constraints.
          </p>
        </div>
      </header>
      <BriefForm />
    </main>
  );
}
