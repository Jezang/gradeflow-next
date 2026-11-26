// Keep both portals gated until trusted provisioning, reviewed rules and release checks are complete.
export const advisorPortalEnabled = false;
export const studentPortalEnabled = false;

export type PortalKind = 'advisor' | 'student';

export function isPortalKind(value: string): value is PortalKind {
  return value === 'advisor' || value === 'student';
}

export function portalEnabled(kind: PortalKind) {
  return kind === 'advisor' ? advisorPortalEnabled : studentPortalEnabled;
}
