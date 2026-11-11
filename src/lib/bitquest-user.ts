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
 * POST le launch_token à BitQuest, retourne le profil utilisateur.
 * Jette une Error avec un message court en cas d'échec — l'appelant
 * décide (silencieux côté UX, log technique côté dev).
 */
export async function verifyLaunchTokenAgainstBitquest(
  token: string,
): Promise<BitquestUser> {
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
  const body = (await res.json()) as { ok: boolean; user: BitquestUser };
  if (!body.ok || !body.user?.id) {
    throw new Error("BitQuest : réponse malformée.");
  }
  return body.user;
}
