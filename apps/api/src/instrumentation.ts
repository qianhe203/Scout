/** OpenTelemetry bootstrap — import before other modules. */
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

let started = false;

export function initInstrumentation(): void {
  if (started) return;
  started = true;

  if (process.env.OTEL_LOG_LEVEL === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const spanProcessors = endpoint
    ? [new SimpleSpanProcessor(new OTLPTraceExporter({ url: endpoint }))]
    : [new SimpleSpanProcessor(new ConsoleSpanExporter())];

  const sdk = new NodeSDK({
    resource: new Resource({
      "service.name": process.env.OTEL_SERVICE_NAME ?? "scout-api",
    }),
    spanProcessors,
  });

  sdk.start();
  console.log(
    `[scout] OTel enabled (${endpoint ? "OTLP" : "console"} exporter)`,
  );
}
