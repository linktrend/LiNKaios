import { AiosEventEnvelopeSchema, type AiosEventEnvelope } from "@linktrend/linkskills";
import {
  DiscardPolicy,
  JSONCodec,
  RetentionPolicy,
  StorageType,
  connect,
  nanos,
  type JetStreamClient,
  type JetStreamManager,
  type NatsConnection
} from "nats";

const CANONICAL_SUBJECTS: ReadonlyArray<AiosEventEnvelope["eventType"]> = [
  "aios.task.created",
  "aios.task.assigned",
  "aios.task.accepted",
  "aios.task.progress",
  "aios.task.handoff",
  "aios.task.completed",
  "aios.task.failed",
  "aios.approval.requested",
  "aios.approval.decided",
  "aios.security.exception"
] as const;

const DEFAULT_STREAM_NAME = "AIOS_EVENTS";
const DEFAULT_DLQ_STREAM_NAME = "AIOS_EVENTS_DLQ";
const DLQ_SUBJECT = "aios.dlq.>";
const DUPLICATE_WINDOW_HOURS = 24;

export type AiosEventBusHealth = {
  enabled: boolean;
  mode: "disabled" | "jetstream";
  connection: "connected" | "disconnected";
  streamName: string | null;
  streamReady: boolean;
  streamSubjects: string[];
  dlqStreamName: string | null;
  dlqReady: boolean;
  publishAckMode: "none" | "jetstream-puback";
  deadLetterHook: "none" | "consumer-managed";
  retryPolicy: "none" | "bounded-backoff-consumer-policy";
  lastPublishAck: {
    stream: string;
    seq: number;
    duplicate: boolean;
    publishedAt: string;
  } | null;
  lastPublishError: string | null;
};

export type AiosEventBus = {
  enabled: boolean;
  publish(event: AiosEventEnvelope): Promise<void>;
  health(): AiosEventBusHealth;
  close(): Promise<void>;
};

class NoopEventBus implements AiosEventBus {
  enabled = false;

  async publish(_event: AiosEventEnvelope): Promise<void> {
    return;
  }

  health(): AiosEventBusHealth {
    return {
      enabled: false,
      mode: "disabled",
      connection: "disconnected",
      streamName: null,
      streamReady: false,
      streamSubjects: [],
      dlqStreamName: null,
      dlqReady: false,
      publishAckMode: "none",
      deadLetterHook: "none",
      retryPolicy: "none",
      lastPublishAck: null,
      lastPublishError: null
    };
  }

  async close(): Promise<void> {
    return;
  }
}

class NatsEventBus implements AiosEventBus {
  enabled = true;
  private readonly codec = JSONCodec<AiosEventEnvelope>();
  private lastPublishAck: AiosEventBusHealth["lastPublishAck"] = null;
  private lastPublishError: string | null = null;

  constructor(
    private readonly connection: NatsConnection,
    private readonly jetstream: JetStreamClient,
    private readonly streamName: string,
    private readonly streamSubjects: string[],
    private readonly dlqStreamName: string
  ) {}

  async publish(event: AiosEventEnvelope): Promise<void> {
    const parsed = AiosEventEnvelopeSchema.parse(event);
    try {
      const ack = await this.jetstream.publish(parsed.eventType, this.codec.encode(parsed), {
        msgID: parsed.idempotencyKey
      });
      this.lastPublishAck = {
        stream: ack.stream,
        seq: ack.seq,
        duplicate: ack.duplicate,
        publishedAt: new Date().toISOString()
      };
      this.lastPublishError = null;
    } catch (error) {
      this.lastPublishError =
        error instanceof Error ? error.message : "Unknown JetStream publish failure";
      throw error;
    }
  }

  health(): AiosEventBusHealth {
    return {
      enabled: true,
      mode: "jetstream",
      connection: this.connection.isClosed() ? "disconnected" : "connected",
      streamName: this.streamName,
      streamReady: true,
      streamSubjects: this.streamSubjects,
      dlqStreamName: this.dlqStreamName,
      dlqReady: true,
      publishAckMode: "jetstream-puback",
      deadLetterHook: "consumer-managed",
      retryPolicy: "bounded-backoff-consumer-policy",
      lastPublishAck: this.lastPublishAck,
      lastPublishError: this.lastPublishError
    };
  }

  async close(): Promise<void> {
    await this.connection.drain();
  }
}

export async function createAiosEventBus(natsUrl?: string): Promise<AiosEventBus> {
  if (!natsUrl) {
    return new NoopEventBus();
  }

  const connection = await connect({ servers: natsUrl });
  const manager = await connection.jetstreamManager();
  const streamSubjects = await ensureCanonicalEventStream(manager, DEFAULT_STREAM_NAME);
  await ensureStreamSubjects(manager, DEFAULT_DLQ_STREAM_NAME, [DLQ_SUBJECT]);
  const jetstream = connection.jetstream();

  return new NatsEventBus(
    connection,
    jetstream,
    DEFAULT_STREAM_NAME,
    streamSubjects,
    DEFAULT_DLQ_STREAM_NAME
  );
}

async function ensureCanonicalEventStream(
  manager: JetStreamManager,
  streamName: string
): Promise<string[]> {
  return ensureStreamSubjects(manager, streamName, [...CANONICAL_SUBJECTS]);
}

async function ensureStreamSubjects(
  manager: JetStreamManager,
  streamName: string,
  expectedSubjects: string[]
): Promise<string[]> {
  try {
    const info = await manager.streams.info(streamName);
    const existingSubjects = info.config.subjects ?? [];
    const mergedSubjects = Array.from(new Set([...existingSubjects, ...expectedSubjects]));

    if (mergedSubjects.length !== existingSubjects.length) {
      await manager.streams.update(streamName, {
        ...info.config,
        subjects: mergedSubjects
      });
    }

    return mergedSubjects;
  } catch {
    await manager.streams.add({
      name: streamName,
      subjects: expectedSubjects,
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      discard: DiscardPolicy.Old,
      max_consumers: -1,
      max_msgs: -1,
      max_msgs_per_subject: -1,
      max_bytes: -1,
      max_age: 0,
      max_msg_size: -1,
      num_replicas: 1,
      discard_new_per_subject: false,
      duplicate_window: nanos(DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000),
      allow_direct: true
    });
    return expectedSubjects;
  }
}
