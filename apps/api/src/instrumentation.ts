/** OpenTelemetry bootstrap — import before other modules (U2). */
export function initInstrumentation(): void {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // U2: NodeSDK + OTLPTraceExporter
    console.log("[scout] OTel export enabled (stub — implement in U2)");
  }
}
