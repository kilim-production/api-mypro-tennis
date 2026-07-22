import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  FileCheck2,
  HelpCircle,
  LockKeyhole,
  RefreshCcw,
  Scale,
  ShieldCheck
} from "lucide-react";
import {
  legalDetails,
  legalPublicationReady,
  legalValue,
  mediatorConventionConfirmed,
  missingLegalFields
} from "./legalConfig";
import "./legal.css";

type LegalSection = "mentions" | "cgv" | "privacy" | "refunds" | "support";

const sections: Array<{
  id: LegalSection;
  label: string;
  shortLabel: string;
  icon: typeof Building2;
}> = [
  { id: "mentions", label: "Mentions légales", shortLabel: "Mentions", icon: Building2 },
  { id: "cgv", label: "Conditions de vente", shortLabel: "CGV", icon: FileCheck2 },
  { id: "privacy", label: "Confidentialité", shortLabel: "Données", icon: LockKeyhole },
  { id: "refunds", label: "Remboursements", shortLabel: "Remboursements", icon: RefreshCcw },
  { id: "support", label: "Assistance", shortLabel: "Support", icon: HelpCircle }
];

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="legal-detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SupportLink() {
  if (!legalDetails.email) return <strong>{legalValue(legalDetails.email)}</strong>;
  return <a href={"mailto:" + legalDetails.email}>{legalDetails.email}</a>;
}

function MentionsContent() {
  return (
    <>
      <h2>Identification de l’éditeur</h2>
      <p>
        Le site et le jeu <strong>{legalDetails.gameName}</strong> sont édités par l’entrepreneur
        individuel identifié ci-dessous.
      </p>
      <dl className="legal-details-grid">
        <Detail label="Éditeur">{legalValue(legalDetails.businessName)}</Detail>
        <Detail label="Nom commercial">{legalValue(legalDetails.tradeName)}</Detail>
        <Detail label="Jeu et service">{legalValue(legalDetails.gameName)}</Detail>
        <Detail label="Responsable">{legalValue(legalDetails.ownerName)}</Detail>
        <Detail label="Forme ou statut">{legalValue(legalDetails.legalStatus)}</Detail>
        <Detail label="Immatriculation">{legalValue(legalDetails.registration)}</Detail>
        <Detail label="TVA">{legalValue(legalDetails.vatNumber)}</Detail>
        <Detail label="Adresse">{legalValue(legalDetails.address)}</Detail>
        <Detail label="Téléphone">{legalValue(legalDetails.phone)}</Detail>
        <Detail label="Courriel">
          <SupportLink />
        </Detail>
        <Detail label="Directeur de publication">
          {legalValue(legalDetails.publicationDirector)}
        </Detail>
        <Detail label="Adresse du jeu">
          <a href={legalDetails.publicUrl} rel="noreferrer" target="_blank">
            {legalDetails.publicUrl}
          </a>
        </Detail>
      </dl>

      <h2>Hébergement</h2>
      <dl className="legal-details-grid">
        <Detail label="Hébergeur du site">{legalValue(legalDetails.hostName)}</Detail>
        <Detail label="Adresse de l’hébergeur">{legalValue(legalDetails.hostAddress)}</Detail>
        <Detail label="Contact de l’hébergeur">{legalValue(legalDetails.hostPhone)}</Detail>
      </dl>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque, l’interface, les textes, le code, les illustrations et les éléments graphiques de
        MYPRO TENNIS sont protégés par les règles applicables à la propriété intellectuelle. Toute
        reproduction ou exploitation non autorisée est interdite, sous réserve des droits des
        auteurs et fournisseurs expressément crédités.
      </p>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h2>1. Objet et champ d’application</h2>
      <p>
        Les présentes conditions encadrent les achats réalisés par un consommateur dans la boutique
        MYPRO TENNIS. Elles s’appliquent aux packs de gemmes payés en euros et à l’utilisation de
        ces gemmes pour obtenir des contenus numériques dans le jeu.
      </p>

      <h2>2. Mineurs et autorisation parentale</h2>
      <p>
        Le jeu est accessible aux mineurs avec l’autorisation de leur représentant légal. Tout achat
        en euros par un mineur doit être préalablement autorisé par ce représentant. Avant chaque
        paiement, l’acheteur certifie être majeur ou disposer de cette autorisation parentale.
      </p>

      <h2>3. Produits numériques et prix</h2>
      <p>
        La quantité de gemmes, le prix total TTC en euros et les éventuels bonus sont affichés avant
        la commande. Les gemmes sont une monnaie virtuelle utilisable uniquement dans MYPRO TENNIS.
        Elles ne constituent ni une monnaie ayant cours légal, ni un produit financier, et ne sont
        pas convertibles en argent réel en dehors des remboursements imposés par la loi ou acceptés
        par le vendeur.
      </p>
      <p>
        Les probabilités des sacs aléatoires sont affichées avant leur acquisition. Le Pack de
        saison est acquis avec des gemmes et ses avantages, sa durée et son prix en gemmes sont
        présentés dans la boutique avant validation.
      </p>

      <h2>4. Commande et paiement</h2>
      <p>
        Avant le paiement, le joueur peut vérifier le produit, la quantité de gemmes et le prix
        total, puis corriger ou abandonner sa commande. Le paiement est traité par Stripe. MYPRO
        TENNIS ne reçoit pas le numéro complet de la carte bancaire. La commande devient définitive
        après validation du paiement par Stripe.
      </p>

      <h2>5. Livraison immédiate</h2>
      <p>
        Les gemmes sont créditées sur le compte de jeu après confirmation du paiement. Pour recevoir
        le contenu immédiatement, le joueur doit demander expressément le commencement immédiat de
        l’exécution et reconnaître la perte de son droit de rétractation une fois le contenu
        numérique livré. Cet accord n’est jamais précoché.
      </p>

      <h2>6. Droit de rétractation et remboursements</h2>
      <p>
        Avant la livraison du contenu numérique, le consommateur conserve les droits prévus par la
        réglementation applicable. Après livraison immédiate demandée expressément et renoncement
        exprès, le droit de rétractation ne s’applique plus au contenu livré. Cette règle ne prive
        pas le consommateur de ses droits en cas de paiement frauduleux, d’absence de livraison ou
        de non-conformité. Les modalités pratiques figurent dans la rubrique Remboursements.
      </p>

      <h2>7. Compte de jeu et disponibilité</h2>
      <p>
        Les contenus sont rattachés au compte ayant effectué l’achat. Le joueur doit protéger ses
        identifiants et signaler rapidement tout accès non autorisé. Des interruptions temporaires
        peuvent être nécessaires pour la sécurité ou la maintenance ; elles ne suppriment pas les
        droits légaux du consommateur.
      </p>

      <h2>8. Réclamations, droit applicable et médiation</h2>
      <p>
        Toute réclamation doit d’abord être adressée au support MYPRO TENNIS. À défaut de résolution
        amiable, le consommateur peut recourir gratuitement au médiateur indiqué ci-dessous, après
        une réclamation écrite préalable restée sans solution.
      </p>
      <dl className="legal-details-grid">
        <Detail label="Médiateur">{legalValue(legalDetails.mediatorName)}</Detail>
        <Detail label="Adresse">{legalValue(legalDetails.mediatorAddress)}</Detail>
        <Detail label="Courriel">
          <a href={`mailto:${legalDetails.mediatorEmail}`}>{legalDetails.mediatorEmail}</a>
        </Detail>
        <Detail label="Site du médiateur">
          {legalDetails.mediatorUrl ? (
            <a href={legalDetails.mediatorUrl} rel="noreferrer" target="_blank">
              {legalDetails.mediatorUrl}
            </a>
          ) : (
            legalValue(legalDetails.mediatorUrl)
          )}
        </Detail>
      </dl>
      <p>
        Les présentes conditions sont soumises au droit français, sans priver le consommateur des
        règles impératives protectrices applicables dans son pays de résidence. Version :
        <strong> {legalDetails.version}</strong>.
      </p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>Responsable du traitement</h2>
      <p>
        Le responsable du traitement est <strong>{legalValue(legalDetails.businessName)}</strong>,
        joignable à l’adresse suivante : <SupportLink />.
      </p>

      <h2>Comptes de mineurs</h2>
      <p>
        L’utilisation du jeu et les achats par un mineur nécessitent l’autorisation de son
        représentant légal. Ce représentant peut exercer les droits relatifs aux données du mineur
        en écrivant au support et en fournissant les éléments nécessaires à la vérification de son
        identité et de son autorité parentale.
      </p>

      <h2>Données traitées</h2>
      <ul>
        <li>données de compte : adresse électronique, identifiant et mot de passe chiffré ;</li>
        <li>
          profil et progression : joueur, statistiques, matchs, club, inventaire et récompenses ;
        </li>
        <li>
          achats : produit, montant, état du paiement, référence Stripe, reçu et remboursements ;
        </li>
        <li>
          données techniques et de sécurité : adresse IP, journaux et informations de connexion ;
        </li>
        <li>échanges adressés au support.</li>
      </ul>
      <p>MYPRO TENNIS ne stocke pas le numéro complet de votre carte bancaire.</p>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>création du compte et fourniture du jeu : exécution du contrat ;</li>
        <li>
          traitement des achats et remboursements : exécution du contrat et obligations légales ;
        </li>
        <li>prévention de la fraude et sécurité : intérêt légitime de protection du service ;</li>
        <li>conservation des justificatifs : obligations comptables et fiscales applicables ;</li>
        <li>communications optionnelles : consentement lorsqu’il est requis.</li>
      </ul>

      <h2>Destinataires et prestataires</h2>
      <p>
        Les données sont accessibles aux personnes autorisées à exploiter le jeu et, dans la stricte
        mesure nécessaire, aux prestataires d’hébergement, de base de données, d’authentification et
        de paiement, notamment Stripe pour le paiement. Certains prestataires peuvent traiter des
        données hors de l’Espace économique européen avec les garanties prévues par la
        réglementation.
      </p>

      <h2>Durées et sécurité</h2>
      <p>
        Les données de compte et de jeu sont conservées pendant la relation avec le joueur puis
        pendant la durée nécessaire au règlement des demandes et litiges. Les justificatifs de
        transaction sont conservés pendant les durées légales comptables et fiscales. Les journaux
        techniques sont conservés pendant une durée proportionnée à la sécurité du service.
      </p>

      <h2>Stockage local et traceurs</h2>
      <p>
        Le jeu utilise le stockage local du navigateur pour maintenir la connexion, les préférences
        et l’avancement des tutoriels. Aucun traceur publicitaire ou de mesure d’audience optionnel
        n’est actuellement installé par MYPRO TENNIS. Stripe peut utiliser ses propres dispositifs
        sur sa page de paiement conformément à sa documentation.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès, la rectification, l’effacement ou la limitation de vos
        données, ainsi que leur portabilité ou vous opposer à certains traitements lorsque ces
        droits sont applicables. Adressez votre demande à <SupportLink />. Vous pouvez également
        introduire une réclamation auprès de la
        <a href="https://www.cnil.fr" rel="noreferrer" target="_blank">
          {" "}
          CNIL
        </a>
        .
      </p>
    </>
  );
}

function RefundsContent() {
  return (
    <>
      <h2>Avant la livraison des gemmes</h2>
      <p>
        Si le paiement est annulé ou refusé, aucune gemme n’est créditée. Si un paiement est
        confirmé sans que les gemmes soient livrées, contactez immédiatement le support afin que la
        livraison soit régularisée ou que le paiement soit remboursé.
      </p>

      <h2>Après livraison immédiate</h2>
      <p>
        Lorsque le joueur a demandé la livraison immédiate et renoncé expressément à son droit de
        rétractation, une simple demande de changement d’avis ne donne pas automatiquement droit à
        un remboursement après livraison. Les droits légaux liés à la fraude, à l’absence de
        livraison ou à la non-conformité restent applicables.
      </p>

      <h2>Effet d’un remboursement</h2>
      <p>
        Un remboursement validé retire du compte les gemmes correspondant au montant remboursé. Si
        ces gemmes ont déjà été dépensées, les gemmes disponibles sont retirées en priorité et le
        reliquat est enregistré comme dette de gemmes, régularisée sur les prochains crédits de
        gemmes. Le solde utilisable n’est pas affiché en négatif.
      </p>

      <h2>Comment faire une demande</h2>
      <ol>
        <li>ouvrez « Mes achats » dans la Boutique et retrouvez la transaction ;</li>
        <li>notez la date, le produit et la référence figurant sur le reçu Stripe ;</li>
        <li>
          contactez <SupportLink /> en expliquant le problème rencontré ;
        </li>
        <li>ne transmettez jamais votre numéro complet de carte bancaire.</li>
      </ol>
      <p>
        Lorsqu’un remboursement est accordé, il est exécuté par le même moyen de paiement, sauf
        accord exprès ou exigence légale contraire. Le délai bancaire d’apparition du crédit dépend
        ensuite de Stripe et de l’établissement bancaire.
      </p>
    </>
  );
}

function SupportContent() {
  return (
    <>
      <h2>Contacter MYPRO TENNIS</h2>
      <dl className="legal-details-grid">
        <Detail label="Courriel">
          <SupportLink />
        </Detail>
        <Detail label="Téléphone">{legalValue(legalDetails.phone)}</Detail>
        <Detail label="Adresse postale">{legalValue(legalDetails.address)}</Detail>
      </dl>
      <h2>Pour une demande liée à un achat</h2>
      <p>
        Indiquez l’adresse électronique du compte, le produit acheté, la date, la référence du reçu
        et une description du problème. N’envoyez jamais votre mot de passe, le cryptogramme ou le
        numéro complet de votre carte.
      </p>
      <h2>Escalade d’un litige</h2>
      <p>
        Après une réclamation écrite auprès du support et en l’absence de solution amiable, vous
        pouvez saisir le médiateur de la consommation indiqué dans les Conditions de vente.
      </p>
    </>
  );
}

const content: Record<LegalSection, () => JSX.Element> = {
  mentions: MentionsContent,
  cgv: TermsContent,
  privacy: PrivacyContent,
  refunds: RefundsContent,
  support: SupportContent
};

function normalizedSection(value: string | undefined): LegalSection {
  return sections.some((section) => section.id === value) ? (value as LegalSection) : "mentions";
}

export function LegalPage() {
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();
  const activeSection = normalizedSection(params.section);
  const ActiveContent = content[activeSection];

  return (
    <div className="legal-cinematic">
      <section className={`legal-stage${legalPublicationReady ? "" : " has-publication-warning"}`}>
        <header className="legal-header">
          <button aria-label="Retour" onClick={() => navigate(-1)} type="button">
            <ArrowLeft />
          </button>
          <button className="legal-brand" onClick={() => navigate("/")} type="button">
            <strong>MYPRO</strong>
            <span>TENNIS</span>
          </button>
          <div>
            <small>Boutique et compte</small>
            <h1>Informations légales</h1>
          </div>
          <span className="legal-security">
            <ShieldCheck /> Paiement protégé
          </span>
        </header>

        <nav className="legal-tabs" aria-label="Rubriques légales">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                aria-current={activeSection === section.id ? "page" : undefined}
                className={activeSection === section.id ? "is-active" : ""}
                key={section.id}
                onClick={() => navigate("/legal/" + section.id)}
                type="button"
              >
                <Icon />
                <span>{section.label}</span>
                <small>{section.shortLabel}</small>
              </button>
            );
          })}
        </nav>

        {!legalPublicationReady ? (
          <aside className="legal-draft-warning" role="alert">
            <Scale />
            <div>
              <strong>Publication commerciale encore verrouillée</strong>
              <span>
                {missingLegalFields.length > 0
                  ? `${missingLegalFields.length} information(s) légale(s) restent à renseigner avant d’activer Stripe LIVE.`
                  : !mediatorConventionConfirmed
                    ? "Les coordonnées sont complètes. La convention d’adhésion à SAS Médiation Solution doit être signée puis confirmée avant d’activer les paiements réels."
                    : "La publication commerciale reste temporairement verrouillée."}
              </span>
            </div>
          </aside>
        ) : null}

        <main className="legal-document">
          <header>
            <span>{sections.find((section) => section.id === activeSection)?.label}</span>
            <small>Version {legalDetails.version}</small>
          </header>
          <article>
            <ActiveContent />
          </article>
        </main>
      </section>
    </div>
  );
}
