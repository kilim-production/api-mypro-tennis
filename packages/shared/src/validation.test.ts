import { describe, expect, it } from "vitest";
import {
  avatarUpdateSchema,
  challengeSchema,
  cosmeticEquipSchema,
  loginSchema,
  playerCreationSchema,
  trainingStartSchema
} from "./index";

describe("validations partagees", () => {
  it("refuse un email invalide", () => {
    expect(loginSchema.safeParse({ email: "demo", password: "demo1234" }).success).toBe(false);
  });

  it("valide une creation de joueur realiste", () => {
    expect(
      playerCreationSchema.safeParse({
        firstName: "Alex",
        lastName: "Moreau",
        nationality: "France",
        gender: "Femme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet",
        avatarPicture: { kind: "preset", id: "pp-01" }
      }).success
    ).toBe(true);
  });

  it("accepte une photo de profil importee compacte", () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

    expect(
      playerCreationSchema.safeParse({
        firstName: "Alex",
        lastName: "Moreau",
        nationality: "France",
        gender: "Femme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet",
        avatarPicture: { kind: "upload", dataUrl: tinyPng }
      }).success
    ).toBe(true);
  });

  it("refuse une photo de profil trop lourde", () => {
    const heavyJpeg = `data:image/jpeg;base64,${"a".repeat(170_000)}`;

    expect(
      playerCreationSchema.safeParse({
        firstName: "Alex",
        lastName: "Moreau",
        nationality: "France",
        gender: "Femme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet",
        avatarPicture: { kind: "upload", dataUrl: heavyJpeg }
      }).success
    ).toBe(false);
  });

  it("refuse un format de photo de profil non autorise", () => {
    expect(
      playerCreationSchema.safeParse({
        firstName: "Alex",
        lastName: "Moreau",
        nationality: "France",
        gender: "Femme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet",
        avatarPicture: { kind: "upload", dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" }
      }).success
    ).toBe(false);
  });

  it("valide une mise a jour de photo de profil", () => {
    expect(
      avatarUpdateSchema.safeParse({
        avatarPicture: { kind: "preset", id: "pp-10" }
      }).success
    ).toBe(true);
  });

  it("refuse une mise a jour de photo inconnue", () => {
    expect(
      avatarUpdateSchema.safeParse({
        avatarPicture: { kind: "preset", id: "pp-99" }
      }).success
    ).toBe(false);
  });

  it("valide les 4 emplacements d'equipement", () => {
    expect(cosmeticEquipSchema.safeParse({ slotIndex: 0 }).success).toBe(true);
    expect(cosmeticEquipSchema.safeParse({ slotIndex: 3 }).success).toBe(true);
    expect(cosmeticEquipSchema.safeParse({ slotIndex: 4 }).success).toBe(false);
  });

  it("limite le sexe du joueur a femme ou homme", () => {
    expect(
      playerCreationSchema.safeParse({
        firstName: "Alex",
        lastName: "Moreau",
        nationality: "France",
        gender: "Non binaire",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet"
      }).success
    ).toBe(false);
  });

  it("refuse un entrainement sans identifiant", () => {
    expect(trainingStartSchema.safeParse({ trainingId: "" }).success).toBe(false);
  });

  it("securise les defis PvP", () => {
    expect(
      challengeSchema.safeParse({
        targetPlayerId: "player-2",
        surface: "Dur",
        tactic: "Agressif",
        risk: "Forte"
      }).success
    ).toBe(true);
  });
});
