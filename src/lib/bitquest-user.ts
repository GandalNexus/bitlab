/**
 * Identité utilisateur BitQuest côté BitLab — LOT 2 (SSO léger GandalNexus).
 *
 * BitQuest émet un `launch_token` (JWT court, 60s TTL, single-use nonce)
 * qu'on reçoit en query param de l'URL deep-link. On le POSTe à
 * `${BITQUEST_URL}/api/auth/verify-launch-token` (CORS autorisé côté
 * BitQuest) pour obtenir le profil utilisateur minimal. Pas de secret
 * côté BitLab : la vérification cryptographique reste serveur BitQuest.
 *
 * Le profil est stocké dans un `zustand` + `sessionStorage` — scope
 * onglet, survit au refresh, disparaît à la fermeture.
 *
 * Side-effects :
 *   - Référer leak : TTL court du token (60s) limite la fenêtre.
 *   - Nonce consommé côté serveur : un replay du token échouera.
 */

export interface BitquestUser {
  id: string;
  pseudo: string;
  role: string;
  email: string | null;
  emailVerified: boolean;
  isGuest: boolean;
  isBot: boolean;
}

/**
 * URL de base de BitQuest. En dev, cible localhost:3000. En prod, doit
 * être configurée via NEXT_PUBLIC_BITQUEST_URL.
 */
export function getBitquestUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BITQUEST_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * true uniquement si NEXT_PUBLIC_BITQUEST_URL est réellement définie.
 * Sans elle, le fallback localhost:3000 désigne BitLab lui-même : les
 * endpoints SSO/logout n'y existent pas, toute navigation les visant
 * doit être évitée (sinon 404).
 */
export function isBitquestConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_BITQUEST_URL?.trim());
}

/**
 * Résultat de l'échange launch_token : profil utilisateur + session
 * token longue durée (2h) pour appels CORS user-scoped ultérieurs.
 */
export interface LaunchTokenExchangeResult {
  user: BitquestUser;
  session: {
    token: string;
    expiresAt: string; // ISO
    ttlSeconds: number;
  };
}

/**
 * POST le launch_token à BitQuest, retourne profil + session token.
 * Jette une Error avec un message court en cas d'échec — l'appelant
 * décide (silencieux côté UX, log technique côté dev).
 */
export async function verifyLaunchTokenAgainstBitquest(
  token: string,
): Promise<LaunchTokenExchangeResult> {
  const url = `${getBitquestUrl()}/api/auth/verify-launch-token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
    // Pas de credentials : la requête est volontairement unauth, le JWT fait foi.
    credentials: "omit",
    mode: "cors",
  });
  if (!res.ok) {
    let msg = `BitQuest verify-launch-token ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as {
    ok: boolean;
    user: BitquestUser;
    session?: { token: string; expiresAt: string; ttlSeconds: number };
  };
  if (!body.ok || !body.user?.id) {
    throw new Error("BitQuest : réponse malformée.");
  }
  if (!body.session?.token) {
    throw new Error("BitQuest : session token absent de la réponse.");
  }
  return { user: body.user, session: body.session };
}

/**
 * Représentation JSON d'une tentative BitLab (serveur BitQuest).
 * Shape alignée sur /api/bitlab/me/attempts.
 */
export interface GandalNexusAttempt {
  id: string;
  questCode: string;
  questTitle: string;
  kind: string;
  network: string;
  state: string;
  launchedAt: string;
  expiresAt: string;
  completedAt: string | null;
  failedAt: string | null;
  failReason: string | null;
  proofId: string | null;
  result: Record<string, unknown> | null;
  returnTo: string | null;
}

/**
 * Récupère les tentatives de l'utilisateur via l'endpoint CORS user-scoped.
 * Nécessite un `sessionToken` valide (émis au verify-launch-token).
 */
export async function fetchMyAttempts(opts: {
  sessionToken: string;
  state?: "active" | "all";
  limit?: number;
}): Promise<GandalNexusAttempt[]> {
  const params = new URLSearchParams();
  if (opts.state) params.set("state", opts.state);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const url = `${getBitquestUrl()}/api/bitlab/me/attempts${
    params.toString() ? `?${params.toString()}` : ""
  }`;
  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${opts.sessionToken}` },
    credentials: "omit",
    mode: "cors",
  });
  if (!res.ok) {
    let msg = `BitQuest /bitlab/me/attempts ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as { attempts: GandalNexusAttempt[] };
  return body.attempts ?? [];
}
