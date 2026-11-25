import { describe, it, expect } from "vitest";
import { videoStatusVariant } from "./videoStatus";

describe("videoStatusVariant", () => {
  it.each([
    ["PUBLISHED", "success"],
    ["PROCESSING", "warning"],
    ["ERROR", "danger"],
    ["DRAFT", "neutral"],
  ])("maps %s to the %s badge", (status, expected) => {
    expect(videoStatusVariant(status)).toBe(expected);
  });

  it("falls back to neutral for a status the API adds later", () => {
    expect(videoStatusVariant("SOMETHING_NEW")).toBe("neutral");
  });
});
