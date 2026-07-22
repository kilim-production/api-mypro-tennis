import { shopLegalVersion } from "@mypro/shared";

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function publicValue(value: string | undefined, fallback: string) {
  return clean(value) || fallback;
}

export const legalDetails = {
  version: shopLegalVersion,
  businessName: publicValue(import.meta.env.VITE_LEGAL_BUSINESS_NAME, "Clément Machet EI"),
  tradeName: publicValue(import.meta.env.VITE_LEGAL_TRADE_NAME, "VIRTUAVISIT.FR"),
  gameName: publicValue(import.meta.env.VITE_LEGAL_GAME_NAME, "MYPRO TENNIS"),
  publicUrl: publicValue(
    import.meta.env.VITE_LEGAL_PUBLIC_URL,
    "https://my-pro-tennis.netlify.app"
  ),
  ownerName: publicValue(import.meta.env.VITE_LEGAL_OWNER_NAME, "Clément Machet"),
  legalStatus: publicValue(
    import.meta.env.VITE_LEGAL_STATUS,
    "Entrepreneur individuel au régime micro-entrepreneur"
  ),
  registration: publicValue(
    import.meta.env.VITE_LEGAL_REGISTRATION,
    "SIREN 812 696 763 · SIRET 812 696 763 00026 · immatriculé au RNE depuis le 1er août 2015"
  ),
  vatNumber: publicValue(
    import.meta.env.VITE_LEGAL_VAT_NUMBER,
    "TVA non applicable, article 293 B du CGI"
  ),
  address: publicValue(
    import.meta.env.VITE_LEGAL_ADDRESS,
    "20 rue des Dragonesses, 80540 Molliens-Dreuil, France"
  ),
  email: publicValue(import.meta.env.VITE_LEGAL_EMAIL, "kilim.production@gmail.com"),
  phone: publicValue(import.meta.env.VITE_LEGAL_PHONE, "+33 6 98 56 87 55"),
  publicationDirector: publicValue(
    import.meta.env.VITE_LEGAL_PUBLICATION_DIRECTOR,
    "Clément Machet"
  ),
  hostName: publicValue(import.meta.env.VITE_LEGAL_HOST_NAME, "Netlify, Inc."),
  hostAddress: publicValue(
    import.meta.env.VITE_LEGAL_HOST_ADDRESS,
    "101 2nd Street, San Francisco, CA 94105, États-Unis"
  ),
  hostPhone: publicValue(
    import.meta.env.VITE_LEGAL_HOST_PHONE,
    "Téléphone non communiqué par Netlify · support@netlify.com"
  ),
  mediatorName: publicValue(import.meta.env.VITE_LEGAL_MEDIATOR_NAME, "SAS Médiation Solution"),
  mediatorAddress: publicValue(
    import.meta.env.VITE_LEGAL_MEDIATOR_ADDRESS,
    "222 chemin de la Bergerie, 01800 Saint-Jean-de-Niost, France"
  ),
  mediatorEmail: publicValue(
    import.meta.env.VITE_LEGAL_MEDIATOR_EMAIL,
    "contact@sasmediationsolution-conso.fr"
  ),
  mediatorUrl: publicValue(
    import.meta.env.VITE_LEGAL_MEDIATOR_URL,
    "https://sasmediationsolution-conso.fr/"
  )
};

export const mediatorConventionConfirmed =
  clean(import.meta.env.VITE_LEGAL_MEDIATOR_CONVENTION_CONFIRMED ?? "1") === "1";

const requiredFields: Array<[string, string]> = [
  ["VITE_LEGAL_BUSINESS_NAME", legalDetails.businessName],
  ["VITE_LEGAL_TRADE_NAME", legalDetails.tradeName],
  ["VITE_LEGAL_GAME_NAME", legalDetails.gameName],
  ["VITE_LEGAL_PUBLIC_URL", legalDetails.publicUrl],
  ["VITE_LEGAL_OWNER_NAME", legalDetails.ownerName],
  ["VITE_LEGAL_STATUS", legalDetails.legalStatus],
  ["VITE_LEGAL_REGISTRATION", legalDetails.registration],
  ["VITE_LEGAL_ADDRESS", legalDetails.address],
  ["VITE_LEGAL_EMAIL", legalDetails.email],
  ["VITE_LEGAL_PHONE", legalDetails.phone],
  ["VITE_LEGAL_PUBLICATION_DIRECTOR", legalDetails.publicationDirector],
  ["VITE_LEGAL_HOST_NAME", legalDetails.hostName],
  ["VITE_LEGAL_HOST_ADDRESS", legalDetails.hostAddress],
  ["VITE_LEGAL_HOST_PHONE", legalDetails.hostPhone],
  ["VITE_LEGAL_MEDIATOR_NAME", legalDetails.mediatorName],
  ["VITE_LEGAL_MEDIATOR_ADDRESS", legalDetails.mediatorAddress],
  ["VITE_LEGAL_MEDIATOR_EMAIL", legalDetails.mediatorEmail],
  ["VITE_LEGAL_MEDIATOR_URL", legalDetails.mediatorUrl]
];

export const missingLegalFields = requiredFields
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const legalPublicationReady = missingLegalFields.length === 0 && mediatorConventionConfirmed;

export function legalValue(value: string) {
  return value;
}
