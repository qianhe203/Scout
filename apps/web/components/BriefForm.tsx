"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRun, type WorkerMode } from "../lib/api";

export interface BriefFormValues {
  company: string;
  companyDescription: string;
  product: string;
  budget: string;
  risk: "low" | "high";
  companyWebsiteUrl: string;
  productUrl: string;
  targetAudience: string;
  admiredCompetitor: string;
  whyTheyBuy: string;
  platformAllowlist: string;
  platformBlocklist: string;
  workerMode: WorkerMode;
}

const initialValues: BriefFormValues = {
  company: "",
  companyDescription: "",
  product: "",
  budget: "5000",
  risk: "low",
  companyWebsiteUrl: "",
  productUrl: "",
  targetAudience: "",
  admiredCompetitor: "",
  whyTheyBuy: "",
  platformAllowlist: "",
  platformBlocklist: "",
  workerMode: "seed-only",
};

function splitList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function buildPayload(values: BriefFormValues) {
  const budget = Number(values.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Budget must be a positive number");
  }

  return {
    company: values.company.trim(),
    companyDescription: values.companyDescription.trim(),
    product: values.product.trim(),
    budget,
    risk: values.risk,
    ...(values.companyWebsiteUrl.trim()
      ? { companyWebsiteUrl: values.companyWebsiteUrl.trim() }
      : {}),
    ...(values.productUrl.trim() ? { productUrl: values.productUrl.trim() } : {}),
    ...(values.targetAudience.trim()
      ? { targetAudience: values.targetAudience.trim() }
      : {}),
    ...(values.admiredCompetitor.trim()
      ? { admiredCompetitor: values.admiredCompetitor.trim() }
      : {}),
    ...(values.whyTheyBuy.trim()
      ? { whyTheyBuy: values.whyTheyBuy.trim() }
      : {}),
    ...(splitList(values.platformAllowlist)
      ? { platformAllowlist: splitList(values.platformAllowlist) }
      : {}),
    ...(splitList(values.platformBlocklist)
      ? { platformBlocklist: splitList(values.platformBlocklist) }
      : {}),
  };
}

export function BriefForm() {
  const router = useRouter();
  const [values, setValues] = useState<BriefFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof BriefFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      const { runId } = await createRun(payload, values.workerMode);
      router.push(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
      setSubmitting(false);
    }
  };

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2 className="panel-title">Client brief</h2>
      <p className="muted">
        Submit a brief to start the Scout pipeline. Seed mode runs without paid
        APIs.
      </p>

      <div className="field-grid">
        <label className="field">
          <span>Company</span>
          <input
            required
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="Acme Co"
          />
        </label>
        <label className="field">
          <span>Product</span>
          <input
            required
            value={values.product}
            onChange={(e) => update("product", e.target.value)}
            placeholder="Weekly meal kit"
          />
        </label>
        <label className="field field-wide">
          <span>Company description</span>
          <textarea
            required
            rows={2}
            value={values.companyDescription}
            onChange={(e) => update("companyDescription", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Budget (USD)</span>
          <input
            required
            type="number"
            min={1}
            value={values.budget}
            onChange={(e) => update("budget", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Risk tier</span>
          <select
            value={values.risk}
            onChange={(e) => update("risk", e.target.value)}
          >
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="field">
          <span>Worker mode</span>
          <select
            value={values.workerMode}
            onChange={(e) => update("workerMode", e.target.value)}
          >
            <option value="seed-only">Seed only (demo)</option>
            <option value="llm">LLM workers</option>
          </select>
        </label>
        <label className="field">
          <span>Company website</span>
          <input
            type="url"
            value={values.companyWebsiteUrl}
            onChange={(e) => update("companyWebsiteUrl", e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="field">
          <span>Product URL</span>
          <input
            type="url"
            value={values.productUrl}
            onChange={(e) => update("productUrl", e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="field field-wide">
          <span>Target audience (hint only)</span>
          <input
            value={values.targetAudience}
            onChange={(e) => update("targetAudience", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Admired competitor</span>
          <input
            value={values.admiredCompetitor}
            onChange={(e) => update("admiredCompetitor", e.target.value)}
          />
        </label>
        <label className="field field-wide">
          <span>Why they buy</span>
          <input
            value={values.whyTheyBuy}
            onChange={(e) => update("whyTheyBuy", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Platform allowlist</span>
          <input
            value={values.platformAllowlist}
            onChange={(e) => update("platformAllowlist", e.target.value)}
            placeholder="tiktok, instagram"
          />
        </label>
        <label className="field">
          <span>Platform blocklist</span>
          <input
            value={values.platformBlocklist}
            onChange={(e) => update("platformBlocklist", e.target.value)}
            placeholder="threads"
          />
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Starting run…" : "Start pipeline run"}
      </button>
    </form>
  );
}
