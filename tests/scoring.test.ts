import { describe, expect, it } from "vitest";
import { clamp, extensionLabel, gradeScore } from "../src/lib/scoring";

describe("core scoring", () => {
  it("clamps inputs", () => {
    expect(clamp(140)).toBe(100);
    expect(clamp(-12)).toBe(0);
  });

  it("maps score boundaries deterministically", () => {
    expect(gradeScore(90)).toBe("A+");
    expect(gradeScore(80)).toBe("A");
    expect(gradeScore(70)).toBe("B");
    expect(gradeScore(60)).toBe("Watch");
    expect(gradeScore(59)).toBe("Avoid");
  });

  it("keeps extension risk separate from quality", () => {
    expect(extensionLabel(29)).toBe("Clean");
    expect(extensionLabel(30)).toBe("Slightly Extended");
    expect(extensionLabel(50)).toBe("Very Extended");
    expect(extensionLabel(70)).toBe("Avoid / Chasing");
  });
});
