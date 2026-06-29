import { z } from "zod";
import { countryCodes, normalizeCountryCode } from "./countries";
export { countries, countryCodes, countryFlag, countryLabel, countryName, normalizeCountryCode } from "./countries";
const personalPictureIds = [
    "pp-01",
    "pp-02",
    "pp-03",
    "pp-04",
    "pp-05",
    "pp-06",
    "pp-07",
    "pp-08",
    "pp-09",
    "pp-10"
];
const maxProfilePictureBytes = 120 * 1024;
const profilePictureDataUrl = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/]+=*$/i;
function dataUrlPayloadBytes(value) {
    const payload = value.split(",")[1] ?? "";
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}
export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().min(2).max(40)
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});
export const avatarPictureSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("preset"),
        id: z.enum(personalPictureIds)
    }),
    z.object({
        kind: z.literal("upload"),
        dataUrl: z
            .string()
            .max(180_000)
            .regex(profilePictureDataUrl, "Format accepte : JPG, PNG ou WebP.")
            .refine((value) => dataUrlPayloadBytes(value) <= maxProfilePictureBytes, "Image limitee a 120 Ko.")
    })
]);
export const avatarUpdateSchema = z.object({
    avatarPicture: avatarPictureSchema
});
export const cosmeticEquipSchema = z.object({
    slotIndex: z.number().int().min(0).max(3)
});
export const fftRankingValues = [
    "NC",
    "40/2",
    "40/1",
    "40",
    "30/5",
    "30/4",
    "30/3",
    "30/2",
    "30/1",
    "30",
    "15/5",
    "15/4",
    "15/3",
    "15/2",
    "15/1",
    "15",
    "5/6",
    "4/6",
    "3/6",
    "2/6",
    "1/6",
    "0",
    "-2/6",
    "-4/6",
    "-15"
];
export const fftRankingSchema = z.enum(fftRankingValues);
export const clubCreateSchema = z.object({
    name: z.string().trim().min(3).max(32),
    tag: z
        .string()
        .trim()
        .min(2)
        .max(5)
        .regex(/^[a-z0-9]+$/i, "Le sigle accepte uniquement lettres et chiffres.")
        .transform((value) => value.toUpperCase()),
    description: z.string().trim().max(280).optional().default(""),
    minimumRanking: fftRankingSchema.optional().default("NC"),
    duesAmount: z.number().int().min(0).max(50_000).optional().default(0)
});
export const clubUpdateSchema = z.object({
    description: z.string().trim().max(280).default(""),
    minimumRanking: fftRankingSchema,
    duesAmount: z.number().int().min(0).max(50_000).default(0)
});
export const clubJoinRequestSchema = z.object({
    message: z.string().trim().max(180).optional().default("")
});
export const clubLeaveSchema = z.object({
    successorPlayerId: z.string().min(1).optional()
});
export const countryCodeSchema = z.preprocess((value) => (typeof value === "string" ? normalizeCountryCode(value) ?? value : value), z.enum(countryCodes));
export const playerCreationSchema = z.object({
    firstName: z.string().min(2).max(28),
    lastName: z.string().min(2).max(32),
    nationality: countryCodeSchema,
    gender: z.enum(["Femme", "Homme"]),
    dominantHand: z.enum(["Droite", "Gauche"]),
    backhand: z.enum(["Une main", "Deux mains"]),
    archetype: z.enum([
        "Gros service",
        "Relanceur",
        "Frappeur de fond",
        "Athlète endurant",
        "Joueur complet"
    ]),
    avatarPicture: avatarPictureSchema.optional()
});
export const trainingStartSchema = z.object({
    trainingId: z.string().min(2)
});
export const matchRequestSchema = z.object({
    opponentId: z.string().optional(),
    surface: z.enum(["Dur", "Terre battue", "Gazon", "Indoor"]).default("Dur").optional(),
    tactic: z
        .enum([
        "Défensif",
        "Équilibré",
        "Agressif",
        "Service-volée",
        "Contreur",
        "Fond de court",
        "Attaque du revers adverse",
        "Jeu varié"
    ])
        .optional(),
    risk: z.enum(["Prudente", "Normale", "Forte"]).optional(),
    format: z.enum(["Un set", "Deux sets gagnants", "Trois sets gagnants"]).default("Un set")
});
export const challengeSchema = z.object({
    targetPlayerId: z.string().min(1),
    surface: matchRequestSchema.shape.surface,
    tactic: matchRequestSchema.shape.tactic,
    risk: matchRequestSchema.shape.risk
});
