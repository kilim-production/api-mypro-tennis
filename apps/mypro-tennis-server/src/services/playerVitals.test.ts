import { describe, expect, it } from "vitest";
import {
  normalizedPlayerVitals,
  playerVitalsAfterMatch,
  playerVitalsAfterTraining
} from "./playerVitals";

describe("état physique du joueur", () => {
  it("répare les anciennes valeurs sorties des limites", () => {
    expect(normalizedPlayerVitals({ energy: -178, fatigue: 222, health: 95, morale: 70 })).toEqual({
      energy: 82,
      fatigue: 12,
      health: 95,
      morale: 70
    });
  });

  it("borne les effets des matchs et entraînements entre 0 et 100", () => {
    expect(
      playerVitalsAfterMatch({ energy: 4, fatigue: 98, health: 95, morale: 70 }, false)
    ).toMatchObject({ energy: 0, fatigue: 100 });
    expect(
      playerVitalsAfterTraining({ energy: 3, fatigue: 99, health: 95, morale: 100 }, 12)
    ).toEqual({ energy: 0, fatigue: 100, morale: 100 });
  });
});
