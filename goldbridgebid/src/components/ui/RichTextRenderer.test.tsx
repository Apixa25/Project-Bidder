import { describe, expect, it } from "vitest";
import { stripHtml } from "./RichTextRenderer";

describe("stripHtml", () => {
  it("leaves plain text alone", () => {
    expect(stripHtml("Hello there")).toBe("Hello there");
  });

  it("turns a paragraph into plain text", () => {
    expect(stripHtml("<p>Hello <strong>there</strong></p>")).toBe(
      "Hello there"
    );
  });

  it("returns an empty string for empty input", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml("")).toBe("");
  });
});
