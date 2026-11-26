import type { PortalSources } from './portal-access';

type FirestoreValue = {
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
};

function unpack(value: FirestoreValue): unknown {
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(unpack);
  if (value.mapValue) return unpackFields(value.mapValue.fields);
  if (typeof value.stringValue === 'string') return value.stringValue;
  if (typeof value.booleanValue === 'boolean') return value.booleanValue;
  if (typeof value.integerValue === 'string') return Number(value.integerValue);
  if (typeof value.doubleValue === 'number') return value.doubleValue;
  if (value.nullValue === null) return null;
  return undefined;
}

function unpackFields(fields: Record<string, FirestoreValue> | undefined) {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, unpack(value)]));
}

function tokenClaims(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function firebasePortalSources(
  config: { apiKey: string; projectId: string },
  request: typeof fetch = fetch,
): PortalSources {
  return {
    async verifyIdentity(token) {
      const claims = tokenClaims(token);
      const now = Math.floor(Date.now() / 1000);
      if (claims?.aud !== config.projectId || claims.iss !== 'https://securetoken.google.com/' + config.projectId ||
          !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
          !Number.isSafeInteger(claims.auth_time) || claims.auth_time <= 0 || claims.auth_time > now) {
        return null;
      }

      // The provider validates the same token before its decoded claims can be trusted.
      const lookup = await request(
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(config.apiKey),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (lookup.status === 400 || lookup.status === 401 || lookup.status === 403) return null;
      if (!lookup.ok) throw new Error('Identity service unavailable');

      const account = (await lookup.json()).users?.[0];
      if (account?.disabled === true || account?.emailVerified !== true ||
          typeof account.localId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(account.localId) ||
          account.localId !== claims.sub || typeof account.validSince !== 'string' ||
          !/^\d{1,12}$/.test(account.validSince) || claims.auth_time < Number(account.validSince)) {
        return null;
      }
      return account.localId;
    },
    async readProjection(uid, token) {
      const root = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.projectId) +
        '/databases/(default)/documents/portalViews/';
      const view = await request(root + encodeURIComponent(uid), {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (view.status === 401 || view.status === 403 || view.status === 404) return null;
      if (!view.ok) throw new Error('Portal view unavailable');
      return unpackFields((await view.json()).fields);
    },
  };
}
