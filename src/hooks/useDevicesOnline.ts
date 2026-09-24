import { useEffect, useRef, useState } from 'react';
import { getMqttClient, onConnectionStatusChange, onMessage } from '../services/mqtt';
import type { ConnectionStatus } from '../services/mqtt';
import { auth } from '../services/firebase';
import { OFFLINE_TIMEOUT, DISCONNECT_GRACE, RECONNECT_GRACE } from './useOnlineTracker';

export type OnlineState = 'checking' | 'online' | 'offline';
export type DeviceKind = 'inverter' | 'charger';

// Same rules as the mobile app (DeviceOnlineWatcher):
//  - online  = a data/status message arrived within the last OFFLINE_TIMEOUT
//    (the ESP32 sends a status heartbeat every second)
//  - a device is never marked online without an actual message
//  - when OUR broker connection drops, keep the last known states for
//    DISCONNECT_GRACE (short network blips must not flip everything offline);
//    after a reconnect, give the devices RECONNECT_GRACE to report again.
// (timeouts shared with useOnlineTracker)
const TICK_MS = 2000;

/**
 * Online/offline state of every device in a list, from ONE wildcard
 * subscription per kind: `{kind}/{uid}/+/status` and `{kind}/{uid}/+/data`.
 * Returns a map deviceId -> state ('checking' until the first message or
 * OFFLINE_TIMEOUT after mounting).
 */
export function useDevicesOnline(
  kind: DeviceKind,
  deviceIds: string[],
): Record<string, OnlineState> {
  const [states, setStates] = useState<Record<string, OnlineState>>({});
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const startedAtRef = useRef<number>(Date.now());
  // While now < holdUntil, states may only go offline -> online, never the
  // other way (disconnect / reconnect grace windows).
  const holdUntilRef = useRef<number>(0);
  const disconnectedRef = useRef<boolean>(false);
  const idsKey = deviceIds.join(',');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || deviceIds.length === 0) return;

    let mounted = true;
    const ids = new Set(deviceIds);
    const prefix = `${kind}/${uid}/`;
    const topics = [`${kind}/${uid}/+/status`, `${kind}/${uid}/+/data`];
    startedAtRef.current = Date.now();

    const evaluate = () => {
      const now = Date.now();
      const holding = now < holdUntilRef.current;
      setStates((prev) => {
        let changed = false;
        const next: Record<string, OnlineState> = {};
        for (const id of ids) {
          const seen = lastSeenRef.current.get(id);
          let state: OnlineState;
          if (seen !== undefined && now - seen < OFFLINE_TIMEOUT && !disconnectedRef.current) {
            state = 'online';
          } else if (holding && prev[id]) {
            state = prev[id];            // grace window: keep the last known state
          } else if (seen === undefined && now - startedAtRef.current < OFFLINE_TIMEOUT) {
            state = 'checking';
          } else {
            state = 'offline';
          }
          next[id] = state;
          if (prev[id] !== state) changed = true;
        }
        if (Object.keys(prev).length !== ids.size) changed = true;
        return changed ? next : prev;
      });
    };

    const unsubscribeMessage = onMessage((topic) => {
      if (!topic.startsWith(prefix)) return;
      // {kind}/{uid}/{deviceId}/{status|data}
      const rest = topic.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) return;
      const deviceId = rest.slice(0, slash);
      const action = rest.slice(slash + 1);
      if (action !== 'status' && action !== 'data') return;
      if (!ids.has(deviceId)) return;
      const firstMessage = !lastSeenRef.current.has(deviceId);
      lastSeenRef.current.set(deviceId, Date.now());
      if (firstMessage) evaluate();      // show "online" right away
    });

    const subscribe = () => {
      getMqttClient()
        .then((client) => {
          if (mounted) client.subscribe(topics);
        })
        .catch((err) => console.error('MQTT subscribe (online list) failed:', err));
    };
    subscribe();

    const unsubscribeStatus = onConnectionStatusChange((status: ConnectionStatus) => {
      if (!mounted) return;
      if (status === 'connected') {
        if (disconnectedRef.current) {
          disconnectedRef.current = false;
          holdUntilRef.current = Date.now() + RECONNECT_GRACE;
          subscribe();                   // clean session: subscriptions are gone
        }
      } else if (status === 'disconnected' && !disconnectedRef.current) {
        disconnectedRef.current = true;
        holdUntilRef.current = Date.now() + DISCONNECT_GRACE;
      }
      evaluate();
    });

    const timer = setInterval(evaluate, TICK_MS);
    evaluate();

    return () => {
      mounted = false;
      clearInterval(timer);
      unsubscribeMessage();
      unsubscribeStatus();
      getMqttClient()
        .then((client) => client.unsubscribe(topics))
        .catch(() => {
          // ignore during cleanup
        });
    };
    // idsKey stands in for deviceIds (new array identity on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, idsKey]);

  return states;
}
