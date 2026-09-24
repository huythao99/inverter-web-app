import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '../services/mqtt';

// Same rules as the mobile app (DeviceOnlineWatcher) and useDevicesOnline:
//  - online  = a data/status message arrived within the last OFFLINE_TIMEOUT
//    (the ESP32 sends a status heartbeat every second)
//  - never marked online without an actual message (not even on reconnect)
//  - when OUR broker connection drops, keep the last state for
//    DISCONNECT_GRACE so a short network blip doesn't flash "Offline";
//    after a reconnect the device gets RECONNECT_GRACE to report again.
export const OFFLINE_TIMEOUT = 15000;
export const DISCONNECT_GRACE = 30000;
export const RECONNECT_GRACE = 15000;
const TICK_MS = 2000;

interface OnlineTracker {
  isOnline: boolean;
  /** Call for every data/status message of the device. */
  markSeen: () => void;
  /** Feed every broker connection status change. */
  trackConnection: (status: ConnectionStatus) => void;
}

/** Online/offline state of ONE device, reset whenever `deviceKey` changes. */
export function useOnlineTracker(deviceKey: string | undefined): OnlineTracker {
  const [isOnline, setIsOnline] = useState(false);
  const lastSeenRef = useRef(0);
  const disconnectedRef = useRef(false);
  const holdUntilRef = useRef(0);

  const evaluate = useCallback(() => {
    const now = Date.now();
    const fresh =
      lastSeenRef.current > 0 &&
      now - lastSeenRef.current < OFFLINE_TIMEOUT &&
      !disconnectedRef.current;
    if (fresh) {
      setIsOnline(true);
    } else if (now >= holdUntilRef.current) {
      setIsOnline(false);
    } // else: inside a grace window -> keep the last known state
  }, []);

  const markSeen = useCallback(() => {
    lastSeenRef.current = Date.now();
    if (!disconnectedRef.current) setIsOnline(true);
  }, []);

  const trackConnection = useCallback(
    (status: ConnectionStatus) => {
      if (status === 'connected') {
        if (disconnectedRef.current) {
          disconnectedRef.current = false;
          holdUntilRef.current = Date.now() + RECONNECT_GRACE;
        }
      } else if (status === 'disconnected' && !disconnectedRef.current) {
        disconnectedRef.current = true;
        holdUntilRef.current = Date.now() + DISCONNECT_GRACE;
      }
      evaluate();
    },
    [evaluate],
  );

  useEffect(() => {
    // New device: forget everything about the previous one.
    lastSeenRef.current = 0;
    holdUntilRef.current = 0;
    setIsOnline(false);
    if (!deviceKey) return;
    const timer = setInterval(evaluate, TICK_MS);
    return () => clearInterval(timer);
  }, [deviceKey, evaluate]);

  return { isOnline, markSeen, trackConnection };
}
