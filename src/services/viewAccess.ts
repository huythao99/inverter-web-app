import { useEffect } from 'react';

/**
 * Read-only access to someone else's device, attached to the API calls of
 * that one device only:
 *  - invite: signed-in viewer, header `X-View-Owner: <ownerUid>`
 *  - link:   anonymous visitor of a public link, header `X-View-Token`
 */
export interface ViewAccess {
  kind: 'inverter' | 'charger';
  deviceId: string;
  owner?: string;
  token?: string;
}

let current: ViewAccess | null = null;
let currentKey = '';

const keyOf = (v: ViewAccess | null) => (v ? JSON.stringify(v) : '');

export function getViewAccess(): ViewAccess | null {
  return current;
}

function setViewAccess(v: ViewAccess | null) {
  current = v;
  currentKey = keyOf(v);
}

/** True when `url` (relative to /api/user) targets the shared device. */
export function isViewedDeviceUrl(url: string | undefined, v: ViewAccess): boolean {
  if (!url) return false;
  const base = `${v.kind === 'inverter' ? '/devices' : '/chargers'}/${encodeURIComponent(v.deviceId)}`;
  const path = url.split('?')[0];
  return path === base || path.startsWith(`${base}/`);
}

/**
 * Activate read-only access while the calling component is mounted. Set
 * synchronously during render so the very first queries already carry it.
 */
export function useViewAccess(access: ViewAccess | null): void {
  const key = keyOf(access);
  if (key !== currentKey) setViewAccess(access);
  useEffect(() => {
    if (key !== currentKey) setViewAccess(access);
    return () => {
      if (currentKey === key) setViewAccess(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
