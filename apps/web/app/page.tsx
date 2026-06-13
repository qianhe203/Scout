const API_URL =
  process.env.NEXT_PUBLIC_HARNESS_API_URL ?? "http://localhost:3001";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Scout</p>
      <h1 style={{ marginTop: 0 }}>Creator Discovery Harness</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Workers do tasks. The harness enforces constraints.
      </p>

      <section
        style={{
          marginTop: "2rem",
          padding: "1.25rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Status</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Monorepo initialized. API:{" "}
          <code>{API_URL}</code>
        </p>
        <p style={{ margin: "0.75rem 0 0", color: "var(--muted)" }}>
          Next: U1 shared schemas → U2 harness core → U5 BriefForm + run page
        </p>
      </section>

      <p style={{ marginTop: "2rem", fontSize: "0.875rem" }}>
        <a href="https://github.com/qianhe203/Scout">GitHub</a>
        {" · "}
        Build spec: <code>docs/HARNESS_PLANNING.md</code>
      </p>
    </main>
  );
}
