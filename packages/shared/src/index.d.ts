import { z } from "zod";
export { countries, countryCodes, countryFlag, countryLabel, countryName, normalizeCountryCode, type CountryCode } from "./countries";
export declare const signupSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    displayName: string;
}, {
    email: string;
    password: string;
    displayName: string;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const avatarPictureSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"preset">;
    id: z.ZodEnum<["pp-01", "pp-02", "pp-03", "pp-04", "pp-05", "pp-06", "pp-07", "pp-08", "pp-09", "pp-10"]>;
}, "strip", z.ZodTypeAny, {
    kind: "preset";
    id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
}, {
    kind: "preset";
    id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"upload">;
    dataUrl: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    kind: "upload";
    dataUrl: string;
}, {
    kind: "upload";
    dataUrl: string;
}>]>;
export declare const avatarUpdateSchema: z.ZodObject<{
    avatarPicture: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        id: z.ZodEnum<["pp-01", "pp-02", "pp-03", "pp-04", "pp-05", "pp-06", "pp-07", "pp-08", "pp-09", "pp-10"]>;
    }, "strip", z.ZodTypeAny, {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    }, {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"upload">;
        dataUrl: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        kind: "upload";
        dataUrl: string;
    }, {
        kind: "upload";
        dataUrl: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    avatarPicture: {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    } | {
        kind: "upload";
        dataUrl: string;
    };
}, {
    avatarPicture: {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    } | {
        kind: "upload";
        dataUrl: string;
    };
}>;
export declare const cosmeticEquipSchema: z.ZodObject<{
    slotIndex: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    slotIndex: number;
}, {
    slotIndex: number;
}>;
export declare const fftRankingValues: readonly ["NC", "40/2", "40/1", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"];
export declare const fftRankingSchema: z.ZodEnum<["NC", "40/2", "40/1", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"]>;
export declare const clubCreateSchema: z.ZodObject<{
    name: z.ZodString;
    tag: z.ZodEffects<z.ZodString, string, string>;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    minimumRanking: z.ZodDefault<z.ZodOptional<z.ZodEnum<["NC", "40/2", "40/1", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"]>>>;
    duesAmount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tag: string;
    description: string;
    minimumRanking: "NC" | "0" | "40/2" | "40/1" | "40" | "30/5" | "30/4" | "30/3" | "30/2" | "30/1" | "30" | "15/5" | "15/4" | "15/3" | "15/2" | "15/1" | "15" | "5/6" | "4/6" | "3/6" | "2/6" | "1/6" | "-2/6" | "-4/6" | "-15";
    duesAmount: number;
}, {
    name: string;
    tag: string;
    description?: string | undefined;
    minimumRanking?: "NC" | "0" | "40/2" | "40/1" | "40" | "30/5" | "30/4" | "30/3" | "30/2" | "30/1" | "30" | "15/5" | "15/4" | "15/3" | "15/2" | "15/1" | "15" | "5/6" | "4/6" | "3/6" | "2/6" | "1/6" | "-2/6" | "-4/6" | "-15" | undefined;
    duesAmount?: number | undefined;
}>;
export declare const clubUpdateSchema: z.ZodObject<{
    description: z.ZodDefault<z.ZodString>;
    minimumRanking: z.ZodEnum<["NC", "40/2", "40/1", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"]>;
    duesAmount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description: string;
    minimumRanking: "NC" | "0" | "40/2" | "40/1" | "40" | "30/5" | "30/4" | "30/3" | "30/2" | "30/1" | "30" | "15/5" | "15/4" | "15/3" | "15/2" | "15/1" | "15" | "5/6" | "4/6" | "3/6" | "2/6" | "1/6" | "-2/6" | "-4/6" | "-15";
    duesAmount: number;
}, {
    minimumRanking: "NC" | "0" | "40/2" | "40/1" | "40" | "30/5" | "30/4" | "30/3" | "30/2" | "30/1" | "30" | "15/5" | "15/4" | "15/3" | "15/2" | "15/1" | "15" | "5/6" | "4/6" | "3/6" | "2/6" | "1/6" | "-2/6" | "-4/6" | "-15";
    description?: string | undefined;
    duesAmount?: number | undefined;
}>;
export declare const clubJoinRequestSchema: z.ZodObject<{
    message: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message?: string | undefined;
}>;
export declare const clubLeaveSchema: z.ZodObject<{
    successorPlayerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    successorPlayerId?: string | undefined;
}, {
    successorPlayerId?: string | undefined;
}>;
export declare const countryCodeSchema: z.ZodEffects<z.ZodEnum<["AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"]>, "AF" | "AX" | "AL" | "DZ" | "AS" | "AD" | "AO" | "AI" | "AQ" | "AG" | "AR" | "AM" | "AW" | "AU" | "AT" | "AZ" | "BS" | "BH" | "BD" | "BB" | "BY" | "BE" | "BZ" | "BJ" | "BM" | "BT" | "BO" | "BQ" | "BA" | "BW" | "BV" | "BR" | "IO" | "BN" | "BG" | "BF" | "BI" | "CV" | "KH" | "CM" | "CA" | "KY" | "CF" | "TD" | "CL" | "CN" | "CX" | "CC" | "CO" | "KM" | "CG" | "CD" | "CK" | "CR" | "CI" | "HR" | "CU" | "CW" | "CY" | "CZ" | "DK" | "DJ" | "DM" | "DO" | "EC" | "EG" | "SV" | "GQ" | "ER" | "EE" | "SZ" | "ET" | "FK" | "FO" | "FJ" | "FI" | "FR" | "GF" | "PF" | "TF" | "GA" | "GM" | "GE" | "DE" | "GH" | "GI" | "GR" | "GL" | "GD" | "GP" | "GU" | "GT" | "GG" | "GN" | "GW" | "GY" | "HT" | "HM" | "VA" | "HN" | "HK" | "HU" | "IS" | "IN" | "ID" | "IR" | "IQ" | "IE" | "IM" | "IL" | "IT" | "JM" | "JP" | "JE" | "JO" | "KZ" | "KE" | "KI" | "KP" | "KR" | "XK" | "KW" | "KG" | "LA" | "LV" | "LB" | "LS" | "LR" | "LY" | "LI" | "LT" | "LU" | "MO" | "MG" | "MW" | "MY" | "MV" | "ML" | "MT" | "MH" | "MQ" | "MR" | "MU" | "YT" | "MX" | "FM" | "MD" | "MC" | "MN" | "ME" | "MS" | "MA" | "MZ" | "MM" | "NA" | "NR" | "NP" | "NL" | "NC" | "NZ" | "NI" | "NE" | "NG" | "NU" | "NF" | "MK" | "MP" | "NO" | "OM" | "PK" | "PW" | "PS" | "PA" | "PG" | "PY" | "PE" | "PH" | "PN" | "PL" | "PT" | "PR" | "QA" | "RE" | "RO" | "RU" | "RW" | "BL" | "SH" | "KN" | "LC" | "MF" | "PM" | "VC" | "WS" | "SM" | "ST" | "SA" | "SN" | "RS" | "SC" | "SL" | "SG" | "SX" | "SK" | "SI" | "SB" | "SO" | "ZA" | "GS" | "SS" | "ES" | "LK" | "SD" | "SR" | "SJ" | "SE" | "CH" | "SY" | "TW" | "TJ" | "TZ" | "TH" | "TL" | "TG" | "TK" | "TO" | "TT" | "TN" | "TR" | "TM" | "TC" | "TV" | "UG" | "UA" | "AE" | "GB" | "US" | "UM" | "UY" | "UZ" | "VU" | "VE" | "VN" | "VG" | "VI" | "WF" | "EH" | "YE" | "ZM" | "ZW", unknown>;
export declare const playerCreationSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    nationality: z.ZodEffects<z.ZodEnum<["AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"]>, "AF" | "AX" | "AL" | "DZ" | "AS" | "AD" | "AO" | "AI" | "AQ" | "AG" | "AR" | "AM" | "AW" | "AU" | "AT" | "AZ" | "BS" | "BH" | "BD" | "BB" | "BY" | "BE" | "BZ" | "BJ" | "BM" | "BT" | "BO" | "BQ" | "BA" | "BW" | "BV" | "BR" | "IO" | "BN" | "BG" | "BF" | "BI" | "CV" | "KH" | "CM" | "CA" | "KY" | "CF" | "TD" | "CL" | "CN" | "CX" | "CC" | "CO" | "KM" | "CG" | "CD" | "CK" | "CR" | "CI" | "HR" | "CU" | "CW" | "CY" | "CZ" | "DK" | "DJ" | "DM" | "DO" | "EC" | "EG" | "SV" | "GQ" | "ER" | "EE" | "SZ" | "ET" | "FK" | "FO" | "FJ" | "FI" | "FR" | "GF" | "PF" | "TF" | "GA" | "GM" | "GE" | "DE" | "GH" | "GI" | "GR" | "GL" | "GD" | "GP" | "GU" | "GT" | "GG" | "GN" | "GW" | "GY" | "HT" | "HM" | "VA" | "HN" | "HK" | "HU" | "IS" | "IN" | "ID" | "IR" | "IQ" | "IE" | "IM" | "IL" | "IT" | "JM" | "JP" | "JE" | "JO" | "KZ" | "KE" | "KI" | "KP" | "KR" | "XK" | "KW" | "KG" | "LA" | "LV" | "LB" | "LS" | "LR" | "LY" | "LI" | "LT" | "LU" | "MO" | "MG" | "MW" | "MY" | "MV" | "ML" | "MT" | "MH" | "MQ" | "MR" | "MU" | "YT" | "MX" | "FM" | "MD" | "MC" | "MN" | "ME" | "MS" | "MA" | "MZ" | "MM" | "NA" | "NR" | "NP" | "NL" | "NC" | "NZ" | "NI" | "NE" | "NG" | "NU" | "NF" | "MK" | "MP" | "NO" | "OM" | "PK" | "PW" | "PS" | "PA" | "PG" | "PY" | "PE" | "PH" | "PN" | "PL" | "PT" | "PR" | "QA" | "RE" | "RO" | "RU" | "RW" | "BL" | "SH" | "KN" | "LC" | "MF" | "PM" | "VC" | "WS" | "SM" | "ST" | "SA" | "SN" | "RS" | "SC" | "SL" | "SG" | "SX" | "SK" | "SI" | "SB" | "SO" | "ZA" | "GS" | "SS" | "ES" | "LK" | "SD" | "SR" | "SJ" | "SE" | "CH" | "SY" | "TW" | "TJ" | "TZ" | "TH" | "TL" | "TG" | "TK" | "TO" | "TT" | "TN" | "TR" | "TM" | "TC" | "TV" | "UG" | "UA" | "AE" | "GB" | "US" | "UM" | "UY" | "UZ" | "VU" | "VE" | "VN" | "VG" | "VI" | "WF" | "EH" | "YE" | "ZM" | "ZW", unknown>;
    gender: z.ZodEnum<["Femme", "Homme"]>;
    dominantHand: z.ZodEnum<["Droite", "Gauche"]>;
    backhand: z.ZodEnum<["Une main", "Deux mains"]>;
    archetype: z.ZodEnum<["Gros service", "Relanceur", "Frappeur de fond", "Athlète endurant", "Joueur complet"]>;
    avatarPicture: z.ZodOptional<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        id: z.ZodEnum<["pp-01", "pp-02", "pp-03", "pp-04", "pp-05", "pp-06", "pp-07", "pp-08", "pp-09", "pp-10"]>;
    }, "strip", z.ZodTypeAny, {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    }, {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"upload">;
        dataUrl: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        kind: "upload";
        dataUrl: string;
    }, {
        kind: "upload";
        dataUrl: string;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    nationality: "AF" | "AX" | "AL" | "DZ" | "AS" | "AD" | "AO" | "AI" | "AQ" | "AG" | "AR" | "AM" | "AW" | "AU" | "AT" | "AZ" | "BS" | "BH" | "BD" | "BB" | "BY" | "BE" | "BZ" | "BJ" | "BM" | "BT" | "BO" | "BQ" | "BA" | "BW" | "BV" | "BR" | "IO" | "BN" | "BG" | "BF" | "BI" | "CV" | "KH" | "CM" | "CA" | "KY" | "CF" | "TD" | "CL" | "CN" | "CX" | "CC" | "CO" | "KM" | "CG" | "CD" | "CK" | "CR" | "CI" | "HR" | "CU" | "CW" | "CY" | "CZ" | "DK" | "DJ" | "DM" | "DO" | "EC" | "EG" | "SV" | "GQ" | "ER" | "EE" | "SZ" | "ET" | "FK" | "FO" | "FJ" | "FI" | "FR" | "GF" | "PF" | "TF" | "GA" | "GM" | "GE" | "DE" | "GH" | "GI" | "GR" | "GL" | "GD" | "GP" | "GU" | "GT" | "GG" | "GN" | "GW" | "GY" | "HT" | "HM" | "VA" | "HN" | "HK" | "HU" | "IS" | "IN" | "ID" | "IR" | "IQ" | "IE" | "IM" | "IL" | "IT" | "JM" | "JP" | "JE" | "JO" | "KZ" | "KE" | "KI" | "KP" | "KR" | "XK" | "KW" | "KG" | "LA" | "LV" | "LB" | "LS" | "LR" | "LY" | "LI" | "LT" | "LU" | "MO" | "MG" | "MW" | "MY" | "MV" | "ML" | "MT" | "MH" | "MQ" | "MR" | "MU" | "YT" | "MX" | "FM" | "MD" | "MC" | "MN" | "ME" | "MS" | "MA" | "MZ" | "MM" | "NA" | "NR" | "NP" | "NL" | "NC" | "NZ" | "NI" | "NE" | "NG" | "NU" | "NF" | "MK" | "MP" | "NO" | "OM" | "PK" | "PW" | "PS" | "PA" | "PG" | "PY" | "PE" | "PH" | "PN" | "PL" | "PT" | "PR" | "QA" | "RE" | "RO" | "RU" | "RW" | "BL" | "SH" | "KN" | "LC" | "MF" | "PM" | "VC" | "WS" | "SM" | "ST" | "SA" | "SN" | "RS" | "SC" | "SL" | "SG" | "SX" | "SK" | "SI" | "SB" | "SO" | "ZA" | "GS" | "SS" | "ES" | "LK" | "SD" | "SR" | "SJ" | "SE" | "CH" | "SY" | "TW" | "TJ" | "TZ" | "TH" | "TL" | "TG" | "TK" | "TO" | "TT" | "TN" | "TR" | "TM" | "TC" | "TV" | "UG" | "UA" | "AE" | "GB" | "US" | "UM" | "UY" | "UZ" | "VU" | "VE" | "VN" | "VG" | "VI" | "WF" | "EH" | "YE" | "ZM" | "ZW";
    gender: "Femme" | "Homme";
    dominantHand: "Droite" | "Gauche";
    backhand: "Une main" | "Deux mains";
    archetype: "Gros service" | "Relanceur" | "Frappeur de fond" | "Athlète endurant" | "Joueur complet";
    avatarPicture?: {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    } | {
        kind: "upload";
        dataUrl: string;
    } | undefined;
}, {
    firstName: string;
    lastName: string;
    gender: "Femme" | "Homme";
    dominantHand: "Droite" | "Gauche";
    backhand: "Une main" | "Deux mains";
    archetype: "Gros service" | "Relanceur" | "Frappeur de fond" | "Athlète endurant" | "Joueur complet";
    avatarPicture?: {
        kind: "preset";
        id: "pp-01" | "pp-02" | "pp-03" | "pp-04" | "pp-05" | "pp-06" | "pp-07" | "pp-08" | "pp-09" | "pp-10";
    } | {
        kind: "upload";
        dataUrl: string;
    } | undefined;
    nationality?: unknown;
}>;
export declare const trainingStartSchema: z.ZodObject<{
    trainingId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    trainingId: string;
}, {
    trainingId: string;
}>;
export declare const matchRequestSchema: z.ZodObject<{
    opponentId: z.ZodOptional<z.ZodString>;
    surface: z.ZodOptional<z.ZodDefault<z.ZodEnum<["Dur", "Terre battue", "Gazon", "Indoor"]>>>;
    tactic: z.ZodOptional<z.ZodEnum<["Défensif", "Équilibré", "Agressif", "Service-volée", "Contreur", "Fond de court", "Attaque du revers adverse", "Jeu varié"]>>;
    risk: z.ZodOptional<z.ZodEnum<["Prudente", "Normale", "Forte"]>>;
    format: z.ZodDefault<z.ZodEnum<["Un set", "Deux sets gagnants", "Trois sets gagnants"]>>;
}, "strip", z.ZodTypeAny, {
    format: "Un set" | "Deux sets gagnants" | "Trois sets gagnants";
    opponentId?: string | undefined;
    surface?: "Dur" | "Terre battue" | "Gazon" | "Indoor" | undefined;
    tactic?: "Défensif" | "Équilibré" | "Agressif" | "Service-volée" | "Contreur" | "Fond de court" | "Attaque du revers adverse" | "Jeu varié" | undefined;
    risk?: "Prudente" | "Normale" | "Forte" | undefined;
}, {
    opponentId?: string | undefined;
    surface?: "Dur" | "Terre battue" | "Gazon" | "Indoor" | undefined;
    tactic?: "Défensif" | "Équilibré" | "Agressif" | "Service-volée" | "Contreur" | "Fond de court" | "Attaque du revers adverse" | "Jeu varié" | undefined;
    risk?: "Prudente" | "Normale" | "Forte" | undefined;
    format?: "Un set" | "Deux sets gagnants" | "Trois sets gagnants" | undefined;
}>;
export declare const challengeSchema: z.ZodObject<{
    targetPlayerId: z.ZodString;
    surface: z.ZodOptional<z.ZodDefault<z.ZodEnum<["Dur", "Terre battue", "Gazon", "Indoor"]>>>;
    tactic: z.ZodOptional<z.ZodEnum<["Défensif", "Équilibré", "Agressif", "Service-volée", "Contreur", "Fond de court", "Attaque du revers adverse", "Jeu varié"]>>;
    risk: z.ZodOptional<z.ZodEnum<["Prudente", "Normale", "Forte"]>>;
}, "strip", z.ZodTypeAny, {
    targetPlayerId: string;
    surface?: "Dur" | "Terre battue" | "Gazon" | "Indoor" | undefined;
    tactic?: "Défensif" | "Équilibré" | "Agressif" | "Service-volée" | "Contreur" | "Fond de court" | "Attaque du revers adverse" | "Jeu varié" | undefined;
    risk?: "Prudente" | "Normale" | "Forte" | undefined;
}, {
    targetPlayerId: string;
    surface?: "Dur" | "Terre battue" | "Gazon" | "Indoor" | undefined;
    tactic?: "Défensif" | "Équilibré" | "Agressif" | "Service-volée" | "Contreur" | "Fond de court" | "Attaque du revers adverse" | "Jeu varié" | undefined;
    risk?: "Prudente" | "Normale" | "Forte" | undefined;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PlayerCreationInput = z.infer<typeof playerCreationSchema>;
export type AvatarUpdateInput = z.infer<typeof avatarUpdateSchema>;
export type CosmeticEquipInput = z.infer<typeof cosmeticEquipSchema>;
export type ClubCreateInput = z.infer<typeof clubCreateSchema>;
export type ClubUpdateInput = z.infer<typeof clubUpdateSchema>;
export type ClubJoinRequestInput = z.infer<typeof clubJoinRequestSchema>;
export type ClubLeaveInput = z.infer<typeof clubLeaveSchema>;
