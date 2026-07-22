import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shopLegalVersion } from "@mypro/shared";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileCheck2,
  Gem,
  Gift,
  HelpCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  ReceiptText,
  RefreshCw,
  Trophy,
  X,
  Zap
} from "lucide-react";
import { useGameStore } from "../../store";
import { api } from "../../api";
import { legalPublicationReady, missingLegalFields } from "../legal/legalConfig";
import "./shop.css";

type ShopTab = "featured" | "gems" | "bags" | "credits";
type BagPackId = "discovery" | "competition" | "elite";

type GemPack = {
  id: string;
  gems: number;
  price: string;
  bonus?: string;
  art: "diamond" | "pile" | "pouch" | "chest";
};

type BagPack = {
  id: BagPackId;
  label: string;
  price: number;
  image: string;
  probabilities: Array<{ label: string; value: number; tone: string }>;
};

type ShopSeasonPass = {
  id: string;
  startsAt: string;
  expiresAt: string;
  remainingMs: number;
  active: boolean;
};

type ShopCatalogResponse = {
  gemPacks: Array<{
    id: string;
    gems: number;
    priceCents: number;
    bonusPercent: number;
  }>;
  bagPacks: Array<{
    id: string;
    label: string;
    gemPrice: number;
    odds: Array<{ rarity: string; probability: number }>;
  }>;
  creditPacks: Array<{ id: string; gemPrice: number; credits: number }>;
  seasonPassProduct: {
    id: "season-pass";
    gemPrice: number;
    referencePriceCents: number;
    durationDays: number;
  };
  seasonPass: ShopSeasonPass | null;
  wallet: { gems: number; gemDebt?: number; credits: number };
  payments: {
    provider: "STRIPE";
    enabled: boolean;
    mode: "UNCONFIGURED" | "TEST" | "LIVE";
    webhookConfigured: boolean;
  };
};

type ShopPurchaseResponse = {
  purchase: {
    productId: string;
    rewards: {
      credits?: number;
      chest?: { rarity: string; slotIndex: number };
      seasonPass?: { expiresAt: string };
    };
  };
  seasonPass: ShopSeasonPass | null;
  wallet: { gems: number; gemDebt?: number; credits: number };
};

type StripeCheckoutResponse = {
  purchase: { productId: string; status: string };
  checkout: { id: string; url: string | null; status: string | null; expiresAt: number } | null;
  alreadyCompleted: boolean;
  wallet?: { gems: number; gemDebt?: number; credits: number };
};

type StripeCheckoutState = {
  pending?: boolean;
  purchase?: {
    productId: string;
    status: string;
    rewards: { gems?: number };
  };
  wallet?: { gems: number; gemDebt?: number; credits: number };
};

type ShopHistoryPurchase = {
  id: string;
  label: string;
  productId: string;
  currency: string;
  amount: number;
  status: string;
  paymentProvider: string;
  receiptUrl: string | null;
  refundedAmount: number;
  reversedGems: number;
  rewards: { gems?: number; credits?: number; chest?: { rarity?: string } };
  createdAt: string;
};

type ShopHistoryResponse = {
  gemDebt: number;
  purchases: ShopHistoryPurchase[];
};

type CheckoutReview = {
  productId: string;
  gems: number;
  price: string;
};

const gemPacks: GemPack[] = [
  { id: "gems-100", gems: 100, price: "2,99 €", art: "diamond" },
  { id: "gems-225", gems: 225, price: "5,99 €", bonus: "+12 %", art: "pile" },
  { id: "gems-500", gems: 500, price: "11,99 €", bonus: "+25 %", art: "pouch" },
  { id: "gems-1100", gems: 1100, price: "23,99 €", bonus: "+37 %", art: "chest" }
];

const bagPacks: BagPack[] = [
  {
    id: "discovery",
    label: "Découverte",
    price: 50,
    image: "/visuals/chests/tennis-bag-argent.webp",
    probabilities: [
      { label: "Bronze", value: 60, tone: "bronze" },
      { label: "Argent", value: 30, tone: "silver" },
      { label: "Or", value: 9, tone: "gold" },
      { label: "Légendaire", value: 1, tone: "legendary" }
    ]
  },
  {
    id: "competition",
    label: "Compétition",
    price: 100,
    image: "/visuals/chests/tennis-bag-or.webp",
    probabilities: [
      { label: "Bronze", value: 30, tone: "bronze" },
      { label: "Argent", value: 40, tone: "silver" },
      { label: "Or", value: 24, tone: "gold" },
      { label: "Légendaire", value: 5, tone: "legendary" },
      { label: "Mythique", value: 1, tone: "mythic" }
    ]
  },
  {
    id: "elite",
    label: "Élite",
    price: 250,
    image: "/visuals/chests/tennis-bag-mythique.webp",
    probabilities: [
      { label: "Argent", value: 30, tone: "silver" },
      { label: "Or", value: 45, tone: "gold" },
      { label: "Légendaire", value: 20, tone: "legendary" },
      { label: "Mythique", value: 5, tone: "mythic" }
    ]
  }
];

const tabs: Array<{ id: ShopTab; label: string; Icon: LucideIcon }> = [
  { id: "featured", label: "À la une", Icon: Star },
  { id: "gems", label: "Gemmes", Icon: Gem },
  { id: "bags", label: "Sacs", Icon: ShoppingBag },
  { id: "credits", label: "Crédits", Icon: Coins }
];

function formatCredits(value: number) {
  return `${value.toLocaleString("fr-FR")} CR`;
}

function formatPurchaseAmount(purchase: ShopHistoryPurchase) {
  if (purchase.currency === "EUR") {
    return (purchase.amount / 100).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR"
    });
  }
  return `${purchase.amount.toLocaleString("fr-FR")} gemmes`;
}

function purchaseStatusLabel(status: string) {
  if (status === "COMPLETED") return "Validé";
  if (status === "REFUNDED") return "Remboursé";
  if (status === "PARTIALLY_REFUNDED") return "Remboursement partiel";
  if (status === "FAILED") return "Échec";
  if (status === "EXPIRED") return "Expiré";
  return "En cours";
}

function ShopCatalogArtwork({ art, label }: { art: GemPack["art"] | "season"; label: string }) {
  return (
    <div className={`shop-catalog-art is-${art}`} aria-label={label} role="img">
      <img alt="" decoding="async" draggable={false} src="/visuals/shop/shop-catalog-atlas.webp" />
    </div>
  );
}

function ShopHeader({
  energy,
  energyMax,
  gems,
  credits,
  onBack,
  onTab
}: {
  energy: number;
  energyMax: number;
  gems: number;
  credits: number;
  onBack: () => void;
  onTab: (tab: ShopTab) => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="shop-header">
      <button
        aria-label="Retour au hub"
        className="shop-icon-button shop-back"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft />
      </button>
      <button className="shop-brand" onClick={onBack} type="button">
        <strong>MYPRO</strong>
        <span>TENNIS</span>
      </button>
      <h1>BOUTIQUE</h1>
      <div className="shop-resources" aria-label="Ressources du joueur">
        <button onClick={() => navigate("/duel")} type="button">
          <Zap />
          <span>
            <small>Énergie</small>
            <strong>
              {energy}/{energyMax}
            </strong>
          </span>
        </button>
        <button className="is-gems" onClick={() => onTab("gems")} type="button">
          <Gem />
          <span>
            <small>Gemmes</small>
            <strong>{gems.toLocaleString("fr-FR")}</strong>
          </span>
        </button>
        <button className="is-credits" onClick={() => onTab("credits")} type="button">
          <Coins />
          <span>
            <small>Crédits</small>
            <strong>{formatCredits(credits)}</strong>
          </span>
        </button>
      </div>
      <div className="shop-system-actions">
        <button aria-label="Aide Boutique" onClick={() => onTab("featured")} type="button">
          <HelpCircle />
        </button>
        <button aria-label="Réglages" onClick={() => navigate("/settings")} type="button">
          <Settings />
        </button>
        <button aria-label="Fermer la Boutique" onClick={onBack} type="button">
          <X />
        </button>
      </div>
    </header>
  );
}

export function ShopPage() {
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player);
  const patchPlayer = useGameStore((state) => state.patchPlayer);
  const refreshPlayer = useGameStore((state) => state.refresh);
  const [activeTab, setActiveTab] = useState<ShopTab>("featured");
  const [selectedBag, setSelectedBag] = useState<BagPackId>("elite");
  const [selectedConversion, setSelectedConversion] = useState(100);
  const [catalog, setCatalog] = useState<ShopCatalogResponse | null>(null);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<ShopHistoryResponse | null>(null);
  const [checkoutReview, setCheckoutReview] = useState<CheckoutReview | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [immediateDeliveryAccepted, setImmediateDeliveryAccepted] = useState(false);
  const [purchaseAuthorityConfirmed, setPurchaseAuthorityConfirmed] = useState(false);
  const retryKeys = useRef<Record<string, string>>({});
  const noticeTimeout = useRef<number | null>(null);
  const checkoutReturnHandled = useRef(false);

  const selectedBagPack = useMemo(
    () => bagPacks.find((pack) => pack.id === selectedBag) ?? bagPacks[0]!,
    [selectedBag]
  );

  const selectedBagProduct = catalog?.bagPacks.find((pack) => pack.id === `bag-${selectedBag}`);
  const selectedCreditProduct = catalog?.creditPacks.find(
    (pack) => pack.credits === selectedConversion * 100
  );
  const selectedBagOdds = selectedBagProduct
    ? selectedBagProduct.odds.map((chance) => ({
        label: chance.rarity,
        value: chance.probability,
        tone:
          chance.rarity === "Bronze"
            ? "bronze"
            : chance.rarity === "Argent"
              ? "silver"
              : chance.rarity === "Or"
                ? "gold"
                : chance.rarity === "Mythique"
                  ? "mythic"
                  : "legendary"
      }))
    : selectedBagPack.probabilities;
  const creditOptions = catalog?.creditPacks ?? [
    { id: "credits-2500", gemPrice: 25, credits: 2500 },
    { id: "credits-5000", gemPrice: 50, credits: 5000 },
    { id: "credits-10000", gemPrice: 100, credits: 10000 }
  ];
  const seasonPassActive = Boolean(catalog?.seasonPass?.active);
  const seasonPassDaysLeft = catalog?.seasonPass
    ? Math.max(1, Math.ceil(catalog.seasonPass.remainingMs / (24 * 60 * 60 * 1_000)))
    : 0;

  useEffect(() => {
    let cancelled = false;
    void api<ShopCatalogResponse>("/shop/catalog")
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        patchPlayer({ gems: data.wallet.gems, budget: data.wallet.credits });
      })
      .catch(() => {
        if (!cancelled)
          showNotice("Catalogue serveur indisponible. Réessayez dans un instant.", "error");
      });
    return () => {
      cancelled = true;
      if (noticeTimeout.current) window.clearTimeout(noticeTimeout.current);
    };
  }, [patchPlayer]);

  useEffect(() => {
    if (checkoutReturnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("checkout");
    if (!checkoutResult) return;
    checkoutReturnHandled.current = true;

    if (checkoutResult === "cancelled") {
      showNotice("Paiement annulé. Aucun débit et aucune gemme ajoutée.", "error");
      navigate("/shop", { replace: true });
      return;
    }

    const sessionId = params.get("session_id");
    if (checkoutResult !== "success" || !sessionId) {
      showNotice("Retour de paiement invalide.", "error");
      return;
    }

    setBusyProduct("stripe-return");
    void api<StripeCheckoutState>(`/shop/stripe/sessions/${encodeURIComponent(sessionId)}`)
      .then((result) => {
        if (result.pending) {
          showNotice("Paiement reçu, confirmation bancaire en cours.");
          return;
        }
        if (!result.wallet || !result.purchase) {
          throw new Error("Confirmation de paiement incomplète.");
        }
        patchPlayer({ gems: result.wallet.gems, budget: result.wallet.credits });
        setCatalog((current) => (current ? { ...current, wallet: result.wallet! } : current));
        showNotice(`${result.purchase.rewards.gems ?? 0} gemmes ajoutées à votre compte.`);
        void refreshPlayer();
        navigate("/shop", { replace: true });
      })
      .catch((error) => {
        showNotice(
          error instanceof Error ? error.message : "Vérification du paiement impossible.",
          "error"
        );
      })
      .finally(() => setBusyProduct(null));
  }, [navigate, patchPlayer, refreshPlayer]);

  useEffect(() => {
    if (!historyOpen && !checkoutReview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHistoryOpen(false);
      closeCheckoutReview();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [checkoutReview, historyOpen]);

  if (!player) return null;

  function showNotice(message: string, tone: "success" | "error" = "success") {
    if (noticeTimeout.current) window.clearTimeout(noticeTimeout.current);
    setNoticeTone(tone);
    setNotice(message);
    noticeTimeout.current = window.setTimeout(() => setNotice(null), 4200);
  }

  async function startStripeCheckout(productId: string) {
    if (busyProduct) return;
    if (!legalPublicationReady) {
      showNotice("Les informations légales doivent être complétées avant l'ouverture.", "error");
      return;
    }
    if (!termsAccepted || !immediateDeliveryAccepted || !purchaseAuthorityConfirmed) {
      showNotice("Les trois confirmations sont requises avant le paiement.", "error");
      return;
    }
    if (!catalog?.payments.enabled) {
      showNotice("Stripe doit encore être configuré par l'administrateur.", "error");
      return;
    }
    const fallbackKey = `stripe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const idempotencyKey =
      retryKeys.current[productId] ?? globalThis.crypto?.randomUUID?.() ?? fallbackKey;
    retryKeys.current[productId] = idempotencyKey;
    setBusyProduct(productId);
    try {
      const result = await api<StripeCheckoutResponse>("/shop/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({
          productId,
          idempotencyKey,
          termsAccepted: true,
          immediateDeliveryAccepted: true,
          purchaseAuthorityConfirmed: true,
          termsVersion: shopLegalVersion
        })
      });
      if (result.alreadyCompleted && result.wallet) {
        delete retryKeys.current[productId];
        patchPlayer({ gems: result.wallet.gems, budget: result.wallet.credits });
        showNotice("Ce paiement avait déjà été validé. Votre solde est à jour.");
        return;
      }
      if (!result.checkout?.url) throw new Error("Page de paiement Stripe indisponible.");
      window.location.assign(result.checkout.url);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Paiement impossible.", "error");
      setBusyProduct(null);
    }
  }

  function openCheckoutReview(review: CheckoutReview) {
    if (busyProduct) return;
    setTermsAccepted(false);
    setImmediateDeliveryAccepted(false);
    setPurchaseAuthorityConfirmed(false);
    setCheckoutReview(review);
  }

  function closeCheckoutReview() {
    if (busyProduct) return;
    setCheckoutReview(null);
    setTermsAccepted(false);
    setImmediateDeliveryAccepted(false);
    setPurchaseAuthorityConfirmed(false);
  }

  async function loadPurchaseHistory() {
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      setPurchaseHistory(await api<ShopHistoryResponse>("/shop/purchases/history"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Historique indisponible.", "error");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openPurchaseHistory() {
    setHistoryOpen(true);
    void loadPurchaseHistory();
  }

  async function purchaseProduct(productId: string) {
    if (busyProduct) return;
    const fallbackKey = `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const idempotencyKey =
      retryKeys.current[productId] ?? globalThis.crypto?.randomUUID?.() ?? fallbackKey;
    retryKeys.current[productId] = idempotencyKey;
    setBusyProduct(productId);
    try {
      const result = await api<ShopPurchaseResponse>("/shop/purchases", {
        method: "POST",
        body: JSON.stringify({ productId, idempotencyKey })
      });
      delete retryKeys.current[productId];
      patchPlayer({ gems: result.wallet.gems, budget: result.wallet.credits });
      setCatalog((current) =>
        current ? { ...current, wallet: result.wallet, seasonPass: result.seasonPass } : current
      );
      const rewards = result.purchase.rewards;
      if (rewards.chest) {
        showNotice(
          `Sac ${rewards.chest.rarity} ajouté à l'emplacement ${rewards.chest.slotIndex + 1}.`
        );
      } else if (rewards.credits) {
        showNotice(`${formatCredits(rewards.credits)} ajoutés à votre compte.`);
      } else if (rewards.seasonPass) {
        showNotice("Pack de saison activé et coffre mythique récupéré.");
      } else {
        showNotice("Achat validé.");
      }
      void refreshPlayer();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Achat impossible.", "error");
    } finally {
      setBusyProduct(null);
    }
  }

  return (
    <div className="shop-cinematic">
      <section className="shop-stage">
        <ShopHeader
          credits={player.budget}
          energy={player.actionEnergy}
          energyMax={player.actionEnergyMax}
          gems={player.gems}
          onBack={() => navigate("/dashboard")}
          onTab={setActiveTab}
        />

        <nav className="shop-tabs" aria-label="Sections de la Boutique">
          {tabs.map(({ id, label, Icon }) => (
            <button
              aria-current={activeTab === id ? "page" : undefined}
              className={activeTab === id ? "is-active" : ""}
              key={id}
              onClick={() => setActiveTab(id)}
              type="button"
            >
              <Icon />
              <strong>{label}</strong>
            </button>
          ))}
        </nav>

        <main className={`shop-workspace focus-${activeTab}`}>
          <article className="shop-panel shop-season-pass">
            <header>
              <h2>Pack de saison</h2>
              <span>30 jours</span>
            </header>
            <div className="shop-season-visual">
              <div className="shop-season-aura" aria-hidden="true" />
              <ShopCatalogArtwork art="season" label="Coffre mythique du Pack de saison" />
            </div>
            <div className="shop-season-benefits">
              <span>
                <Trophy />
                <strong>+25 % XP après chaque match</strong>
              </span>
              <span>
                <CalendarDays />
                <strong>Récompense journalière ×2</strong>
              </span>
              <span>
                <Gift />
                <strong>1 coffre mythique immédiat</strong>
              </span>
            </div>
            <div className="shop-season-price">
              <span>
                <Gem />
                <strong>{catalog?.seasonPassProduct.gemPrice ?? 100} gemmes</strong>
              </span>
              <b>
                {((catalog?.seasonPassProduct.referencePriceCents ?? 299) / 100).toLocaleString(
                  "fr-FR",
                  { style: "currency", currency: "EUR" }
                )}
              </b>
            </div>
            <button
              className="shop-primary-action"
              disabled={seasonPassActive || busyProduct === "season-pass"}
              onClick={() => void purchaseProduct("season-pass")}
              type="button"
            >
              {seasonPassActive
                ? `Pass actif · ${seasonPassDaysLeft} j`
                : busyProduct === "season-pass"
                  ? "Activation..."
                  : "Débloquer le pass"}
            </button>
          </article>

          <section className="shop-panel shop-gems-panel">
            <h2>Packs de gemmes</h2>
            <div className="shop-gem-grid">
              {gemPacks.map((pack) => {
                const serverPack = catalog?.gemPacks.find((item) => item.id === pack.id);
                const price = serverPack
                  ? (serverPack.priceCents / 100).toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR"
                    })
                  : pack.price;
                const bonus = serverPack?.bonusPercent
                  ? `+${serverPack.bonusPercent} %`
                  : pack.bonus;
                return (
                  <article className="shop-gem-card" key={pack.id}>
                    {bonus ? <span className="shop-bonus-ribbon">{bonus}</span> : null}
                    <h3>{pack.gems.toLocaleString("fr-FR")} gemmes</h3>
                    <ShopCatalogArtwork
                      art={pack.art}
                      label={`Illustration du pack de ${pack.gems.toLocaleString("fr-FR")} gemmes`}
                    />
                    <button
                      aria-busy={busyProduct === pack.id}
                      disabled={Boolean(busyProduct)}
                      onClick={() =>
                        openCheckoutReview({ productId: pack.id, gems: pack.gems, price })
                      }
                      type="button"
                    >
                      {busyProduct === pack.id ? "Connexion..." : price}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="shop-side-stack">
            <section className="shop-panel shop-bags-panel">
              <h2>Packs de sacs</h2>
              <div className="shop-bag-grid">
                {bagPacks.map((pack) => (
                  <button
                    aria-pressed={selectedBag === pack.id}
                    className={`shop-bag-card is-${pack.id} ${selectedBag === pack.id ? "is-selected" : ""}`}
                    key={pack.id}
                    onClick={() => setSelectedBag(pack.id)}
                    type="button"
                  >
                    <strong>{pack.label}</strong>
                    <img alt="" decoding="async" draggable={false} src={pack.image} />
                    <span>
                      {catalog?.bagPacks.find((item) => item.id === `bag-${pack.id}`)?.gemPrice ??
                        pack.price}{" "}
                      gemmes
                    </span>
                    {selectedBag === pack.id ? <Check className="shop-selected-check" /> : null}
                  </button>
                ))}
              </div>
              <div className="shop-probabilities">
                <h3>Probabilités du pack {selectedBagPack.label}</h3>
                <div>
                  {selectedBagOdds.map((chance) => (
                    <span className={`is-${chance.tone}`} key={chance.label}>
                      <i aria-hidden="true" />
                      <small>{chance.label}</small>
                      <strong>{chance.value} %</strong>
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="shop-primary-action"
                disabled={Boolean(busyProduct)}
                onClick={() => void purchaseProduct(`bag-${selectedBag}`)}
                type="button"
              >
                {busyProduct === `bag-${selectedBag}`
                  ? "Achat..."
                  : `Acheter · ${selectedBagProduct?.gemPrice ?? selectedBagPack.price} gemmes`}
              </button>
            </section>

            <section className="shop-panel shop-credits-panel">
              <h2>Convertir en crédits</h2>
              <div className="shop-conversion-grid">
                {creditOptions.map((option) => (
                  <button
                    aria-pressed={selectedConversion === option.gemPrice}
                    className={selectedConversion === option.gemPrice ? "is-selected" : ""}
                    key={option.id}
                    onClick={() => setSelectedConversion(option.gemPrice)}
                    type="button"
                  >
                    <strong>{option.gemPrice} gemmes</strong>
                    <span>
                      <Gem />
                      <ArrowDown />
                    </span>
                    <b>
                      <Coins />
                      {formatCredits(option.credits)}
                    </b>
                  </button>
                ))}
              </div>
              <button
                className="shop-primary-action"
                disabled={Boolean(busyProduct)}
                onClick={() =>
                  void purchaseProduct(
                    selectedCreditProduct?.id ?? `credits-${selectedConversion * 100}`
                  )
                }
                type="button"
              >
                {busyProduct ===
                (selectedCreditProduct?.id ?? `credits-${selectedConversion * 100}`)
                  ? "Conversion..."
                  : "Convertir"}
              </button>
            </section>
          </div>
        </main>

        <footer className="shop-trust-footer">
          <ShieldCheck />
          <span>Prix TTC</span>
          <i>•</i>
          <span>Paiements sécurisés par Stripe</span>
          <i>•</i>
          <span>Probabilités affichées avant achat</span>
          <Link to="/legal/cgv">CGV</Link>
          <Link to="/legal/privacy">Confidentialité</Link>
          <Link to="/legal/refunds">Remboursements</Link>
          <button onClick={openPurchaseHistory} type="button">
            <ReceiptText /> Mes achats
          </button>
        </footer>

        {checkoutReview ? (
          <div className="shop-checkout-backdrop" onClick={closeCheckoutReview} role="presentation">
            <section
              aria-labelledby="shop-checkout-title"
              aria-modal="true"
              className="shop-checkout-dialog"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <header>
                <span>
                  <FileCheck2 />
                </span>
                <div>
                  <small>Commande numérique</small>
                  <h2 id="shop-checkout-title">Vérifier la commande</h2>
                </div>
                <button aria-label="Fermer" onClick={closeCheckoutReview} type="button">
                  <X />
                </button>
              </header>

              <div className="shop-checkout-summary">
                <div>
                  <small>Produit</small>
                  <strong>{checkoutReview.gems.toLocaleString("fr-FR")} gemmes</strong>
                  <span>Créditées sur ce compte après validation Stripe</span>
                </div>
                <div>
                  <small>Total TTC</small>
                  <strong>{checkoutReview.price}</strong>
                  <span>Paiement unique, sans abonnement</span>
                </div>
              </div>

              {!legalPublicationReady ? (
                <div className="shop-checkout-blocked" role="alert">
                  <ShieldCheck />
                  <span>
                    Paiement réel verrouillé : {missingLegalFields.length} information(s) légale(s)
                    restent à renseigner.
                  </span>
                </div>
              ) : null}

              {!catalog?.payments.enabled ? (
                <div className="shop-checkout-blocked" role="alert">
                  <ShieldCheck />
                  <span>
                    Paiements réels encore désactivés par sécurité. Aucun débit ne peut être lancé.
                  </span>
                </div>
              ) : null}

              <div className="shop-checkout-consents">
                <label>
                  <input
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    J’ai lu et j’accepte les{" "}
                    <Link target="_blank" to="/legal/cgv">
                      conditions générales de vente
                    </Link>
                    , la{" "}
                    <Link target="_blank" to="/legal/privacy">
                      politique de confidentialité
                    </Link>{" "}
                    et la{" "}
                    <Link target="_blank" to="/legal/refunds">
                      politique de remboursement
                    </Link>
                    .
                  </span>
                </label>
                <label>
                  <input
                    checked={immediateDeliveryAccepted}
                    onChange={(event) => setImmediateDeliveryAccepted(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Je demande la livraison immédiate des gemmes et reconnais qu’après leur crédit
                    sur mon compte, je perds mon droit de rétractation pour ce contenu numérique.
                  </span>
                </label>
                <label>
                  <input
                    checked={purchaseAuthorityConfirmed}
                    onChange={(event) => setPurchaseAuthorityConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Je certifie être majeur ou disposer de l’autorisation de mon représentant légal
                    pour effectuer cet achat.
                  </span>
                </label>
              </div>

              <footer>
                <button className="is-secondary" onClick={closeCheckoutReview} type="button">
                  Annuler
                </button>
                <button
                  className="is-confirm"
                  disabled={
                    !legalPublicationReady ||
                    !catalog?.payments.enabled ||
                    !termsAccepted ||
                    !immediateDeliveryAccepted ||
                    !purchaseAuthorityConfirmed ||
                    Boolean(busyProduct)
                  }
                  onClick={() => void startStripeCheckout(checkoutReview.productId)}
                  type="button"
                >
                  <CheckCircle2 />
                  {busyProduct === checkoutReview.productId
                    ? "Connexion à Stripe..."
                    : "Commander avec obligation de paiement · " + checkoutReview.price}
                </button>
              </footer>
            </section>
          </div>
        ) : null}

        {historyOpen ? (
          <div
            className="shop-history-backdrop"
            onClick={() => setHistoryOpen(false)}
            role="presentation"
          >
            <section
              aria-label="Historique de mes achats"
              aria-modal="true"
              className="shop-history-dialog"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <header>
                <span>
                  <ReceiptText />
                </span>
                <div>
                  <small>Boutique MYPRO</small>
                  <h2>Mes achats</h2>
                </div>
                <button
                  aria-label="Actualiser l'historique"
                  disabled={historyLoading}
                  onClick={() => void loadPurchaseHistory()}
                  type="button"
                >
                  <RefreshCw className={historyLoading ? "is-spinning" : ""} />
                </button>
                <button aria-label="Fermer" onClick={() => setHistoryOpen(false)} type="button">
                  <X />
                </button>
              </header>

              {purchaseHistory?.gemDebt ? (
                <div className="shop-history-debt" role="alert">
                  <Gem />
                  <span>
                    <strong>{purchaseHistory.gemDebt} gemmes à régulariser</strong>
                    <small>Elles seront déduites de votre prochain achat de gemmes.</small>
                  </span>
                </div>
              ) : null}

              <div className="shop-history-list">
                {historyLoading && !purchaseHistory ? (
                  <div className="shop-history-empty">
                    <RefreshCw className="is-spinning" /> Chargement...
                  </div>
                ) : purchaseHistory?.purchases.length ? (
                  purchaseHistory.purchases.map((purchase) => (
                    <article className={`is-${purchase.status.toLowerCase()}`} key={purchase.id}>
                      <div className="shop-history-product">
                        <span>
                          {purchase.paymentProvider === "STRIPE" ? <Gem /> : <ShoppingBag />}
                        </span>
                        <div>
                          <strong>{purchase.label}</strong>
                          <small>
                            {new Date(purchase.createdAt).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short"
                            })}
                          </small>
                        </div>
                      </div>
                      <div className="shop-history-price">
                        <strong>{formatPurchaseAmount(purchase)}</strong>
                        {purchase.refundedAmount > 0 ? (
                          <small>
                            Remboursé :{" "}
                            {(purchase.refundedAmount / 100).toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR"
                            })}
                          </small>
                        ) : null}
                      </div>
                      <span className="shop-history-status">
                        {purchaseStatusLabel(purchase.status)}
                      </span>
                      {purchase.receiptUrl ? (
                        <a href={purchase.receiptUrl} rel="noreferrer" target="_blank">
                          <ExternalLink /> Reçu
                        </a>
                      ) : (
                        <span className="shop-history-no-receipt">Reçu indisponible</span>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="shop-history-empty">Aucun achat enregistré.</div>
                )}
              </div>

              <footer>
                <ShieldCheck /> Les reçus Stripe reflètent automatiquement les remboursements.
              </footer>
            </section>
          </div>
        ) : null}

        {notice ? (
          <div
            className={`shop-toast is-${noticeTone}`}
            role={noticeTone === "error" ? "alert" : "status"}
          >
            <Sparkles />
            <strong>{notice}</strong>
          </div>
        ) : null}
      </section>
    </div>
  );
}
