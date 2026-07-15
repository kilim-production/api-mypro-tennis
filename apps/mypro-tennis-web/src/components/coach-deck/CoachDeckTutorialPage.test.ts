import { beforeAll, describe, expect, it, vi } from "vitest";

let tutorial: typeof import("./CoachDeckTutorialPage");

beforeAll(async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  });
  tutorial = await import("./CoachDeckTutorialPage");
});

describe("Coach Deck tutorial", () => {
  it("contains three complementary scripted decisions", () => {
    expect(tutorial.COACH_DECK_TUTORIAL_STEPS).toHaveLength(3);
    expect(tutorial.COACH_DECK_TUTORIAL_STEPS.every((step) => step.cards.length === 4)).toBe(true);
    expect(tutorial.COACH_DECK_TUTORIAL_STEPS.map((step) => step.correctChoiceId)).toEqual([
      "protect-backhand",
      "second-wind",
      "PASS"
    ]);
  });

  it("validates only the expected tactical answer", () => {
    expect(tutorial.evaluateCoachDeckTutorialChoice(0, "protect-backhand").correct).toBe(true);
    expect(tutorial.evaluateCoachDeckTutorialChoice(0, "power-forehand").correct).toBe(false);
    expect(tutorial.evaluateCoachDeckTutorialChoice(1, "second-wind").correct).toBe(true);
    expect(tutorial.evaluateCoachDeckTutorialChoice(2, "PASS").correct).toBe(true);
  });

  it("asks for a choice before confirmation", () => {
    expect(tutorial.evaluateCoachDeckTutorialChoice(1, null)).toEqual({
      correct: false,
      message: "Choisissez une action avant de confirmer."
    });
  });
});
