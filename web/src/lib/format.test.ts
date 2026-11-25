import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo, formatDuration, formatElapsed } from "./format";

afterEach(() => {
  vi.useRealTimers();
});

/** Pins "now" so relative-time assertions are not flaky. */
function freezeClockAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("timeAgo", () => {
  const now = "2026-08-12T12:00:00.000Z";

  it.each([
    ["2026-08-12T11:59:59.000Z", "just now", "one second ago"],
    ["2026-08-12T11:59:01.000Z", "just now", "just under a minute"],
    ["2026-08-12T11:59:00.000Z", "1m ago", "exactly one minute"],
    ["2026-08-12T11:01:00.000Z", "59m ago", "just under an hour"],
    ["2026-08-12T11:00:00.000Z", "1h ago", "exactly one hour"],
    ["2026-08-11T13:00:00.000Z", "23h ago", "just under a day"],
    ["2026-08-11T12:00:00.000Z", "1d ago", "exactly one day"],
    ["2026-08-01T12:00:00.000Z", "11d ago", "several days"],
  ])("%s -> %s (%s)", (timestamp, expected) => {
    freezeClockAt(now);
    expect(timeAgo(timestamp)).toBe(expected);
  });

  // The three copies this replaced all did this; a future clock skew from the
  // server should not render as "-3m ago".
  it("does not render a negative age for a future timestamp", () => {
    freezeClockAt(now);
    expect(timeAgo("2026-08-12T12:00:30.000Z")).toBe("just now");
  });
});

describe("formatDuration", () => {
  it("pads the seconds so widths line up in a table column", () => {
    expect(formatDuration(247)).toBe("4m 07s");
  });

  it("renders an em dash when the duration is missing or zero", () => {
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(0)).toBe("—");
  });

  it("keeps counting minutes past an hour rather than rolling over", () => {
    expect(formatDuration(3661)).toBe("61m 01s");
  });
});

describe("formatElapsed", () => {
  it("drops the minutes segment while under a minute", () => {
    expect(formatElapsed(8_000)).toBe("8s");
  });

  it("shows minutes and padded seconds once past a minute", () => {
    expect(formatElapsed(125_000)).toBe("2m 05s");
  });

  it("clamps a negative elapsed time to zero", () => {
    expect(formatElapsed(-5_000)).toBe("0s");
  });
});
