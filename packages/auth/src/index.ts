import jwt from "jsonwebtoken";

export type SessionClaims = {
  userId: string;
  email: string;
};

export function signSession(claims: SessionClaims, secret: string) {
  return jwt.sign(claims, secret, { expiresIn: "7d", issuer: "mypro-tennis" });
}

export function verifySession(token: string, secret: string): SessionClaims {
  return jwt.verify(token, secret, { issuer: "mypro-tennis" }) as SessionClaims;
}
