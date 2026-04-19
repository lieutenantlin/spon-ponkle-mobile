import {
  buildControlRequest,
  decodeCharacteristicValue,
  encodeCharacteristicValue,
  isUnoqEvent,
  isUnoqReply,
  normalizeCaptureFinishedEvent,
  normalizeCaptureStateEvent,
  parseMessageJson,
  parseDeviceInfoJson,
} from "./unoqProtocol";

describe("unoqProtocol", () => {
  it("round-trips control payloads through base64 encoding", () => {
    const request = buildControlRequest("sensors.read");
    const encoded = encodeCharacteristicValue(JSON.stringify(request));
    const decoded = decodeCharacteristicValue(encoded);

    expect(JSON.parse(decoded)).toEqual(request);
  });

  it("parses reply messages", () => {
    const parsed = parseMessageJson(
      JSON.stringify({
        reply_to: "unoq-1",
        ok: true,
        result: { enabled: true },
      })
    );

    expect(isUnoqReply(parsed)).toBe(true);
    if (isUnoqReply(parsed)) {
      expect(parsed.reply_to).toBe("unoq-1");
      expect(parsed.result).toEqual({ enabled: true });
    }
  });

  it("parses event messages and device info", () => {
    const event = parseMessageJson(
      JSON.stringify({
        event: "sensor.update",
        data: { temp_c: 21.5 },
      })
    );
    const deviceInfo = parseDeviceInfoJson(
      JSON.stringify({
        name: "UNO Q Tank Controller",
        pairing_state: "authorized",
      })
    );

    expect(isUnoqEvent(event)).toBe(true);
    if (isUnoqEvent(event)) {
      expect(event.event).toBe("sensor.update");
      expect(event.data).toEqual({ temp_c: 21.5 });
    }
    expect(deviceInfo.pairing_state).toBe("authorized");
  });

  it("normalizes capture state and finished events", () => {
    const state = normalizeCaptureStateEvent({
      sequence_id: "seq-1",
      state: "awaiting_camera_ready",
      step_index: 2,
      step_count: 5,
      progress_pct: 60,
      instruction: "Align camera",
      remaining_ms: 9000,
      light_on: true,
      stepper_active: false,
    });
    const finished = normalizeCaptureFinishedEvent({
      sequence_id: "seq-1",
      outcome: "completed",
      reason: "ok",
      capture_count: 1,
    });

    expect(state).toMatchObject({
      sequenceId: "seq-1",
      state: "awaiting_camera_ready",
      progressPct: 60,
      instruction: "Align camera",
    });
    expect(finished).toMatchObject({
      sequenceId: "seq-1",
      outcome: "completed",
      reason: "ok",
      captureCount: 1,
    });
  });
});
