import { describe, expect, it } from "vitest";
import { generateDailyReminder } from "../src/lib/daily-reminder";
import type { DailyReflection } from "../src/types/domain";

function reflection(overrides: Partial<DailyReflection> = {}): DailyReflection {
  return {
    id: "one",
    tradingDate: "2026-06-10",
    notes: "",
    endOfDayReflection: "",
    nextDayLesson: "",
    createdAt: "2026-06-10T21:00:00.000Z",
    updatedAt: "2026-06-10T21:00:00.000Z",
    ...overrides,
  };
}

describe("daily reminder generation", () => {
  it("uses an explicit next-day lesson before inferred themes", () => {
    const result = generateDailyReminder([reflection({ nextDayLesson: "Wait for the 5-minute close and clean volume." })], []);
    expect(result.message).toBe("Wait for the 5-minute close and clean volume.");
    expect(result.theme).toBe("direct-lesson");
  });

  it("detects a repeated stop-management mistake", () => {
    const result = generateDailyReminder([reflection({ endOfDayReflection: "I moved my stop and gave back gains." })], []);
    expect(result.theme).toBe("moving-stop");
    expect(result.message).toContain("Do not move your stop");
  });

  it("uses a practical default without journal evidence", () => {
    expect(generateDailyReminder([], []).message).toBe("Wait for confirmation. Clean level, clean volume, clean close.");
  });
});
