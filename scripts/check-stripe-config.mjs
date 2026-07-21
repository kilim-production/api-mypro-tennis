import "dotenv/config";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const liveEnabled = process.env.STRIPE_LIVE_PAYMENTS_ENABLED === "1";
const clientUrls = (process.env.CLIENT_URL ?? "http://localhost:5173")
  .split(/[,\s]+/)
  .map((value) => value.trim())
  .filter(Boolean);

const results = [];

function check(label, valid, detail) {
  results.push({ label, valid, detail });
}

const keyMode = secretKey.startsWith("sk_live_")
  ? "LIVE"
  : secretKey.startsWith("sk_test_")
    ? "TEST"
    : "UNCONFIGURED";

check(
  "Cle secrete Stripe",
  keyMode !== "UNCONFIGURED",
  keyMode === "UNCONFIGURED" ? "Ajoutez une cle sk_test_... pour commencer." : `Mode ${keyMode}.`
);
check(
  "Secret du webhook",
  webhookSecret.startsWith("whsec_") && webhookSecret.length > "whsec_".length,
  webhookSecret ? "Le format doit commencer par whsec_." : "Ajoutez STRIPE_WEBHOOK_SECRET."
);
check(
  "URL du jeu",
  clientUrls.every((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }),
  clientUrls.length > 0 ? `${clientUrls.length} URL(s) declaree(s).` : "Ajoutez CLIENT_URL."
);
check(
  "Verrou des paiements reels",
  keyMode !== "LIVE" || liveEnabled,
  keyMode === "LIVE" && !liveEnabled
    ? "Cle live detectee, mais l'activation volontaire reste a 0."
    : liveEnabled
      ? "Paiements reels autorises."
      : "Paiements reels bloques (recommande pendant les tests)."
);
check(
  "Coherence du mode",
  !(keyMode === "TEST" && liveEnabled),
  keyMode === "TEST" && liveEnabled
    ? "Remettez STRIPE_LIVE_PAYMENTS_ENABLED=0 avec une cle de test."
    : "Configuration coherente."
);

console.log("Controle Stripe MYPRO - TENNIS\n");
for (const result of results) {
  console.log(`${result.valid ? "[OK]" : "[A FAIRE]"} ${result.label} - ${result.detail}`);
}

const failed = results.filter((result) => !result.valid);
console.log(
  failed.length === 0
    ? "\nStripe est pret pour un essai de paiement."
    : `\nStripe n'est pas encore pret : ${failed.length} controle(s) a corriger.`
);

if (failed.length > 0) process.exitCode = 1;
