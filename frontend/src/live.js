import { useEffect, useRef } from "react";
import { api, tokens } from "./api.js";

const NOT_LOGGED_IN = 4401;
export const LIVE_EVENT = "muhojir:notification";

export function useLiveNotifications(user, onMessage) {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!user || typeof WebSocket === "undefined") return;
    let socket = null;
    let retry = null;
    let ping = null;
    let delay = 2000;
    let stopped = false;

    const connect = () => {
      if (stopped || !tokens.access) return;
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/notifications/?token=${encodeURIComponent(tokens.access)}`);
      socket.onopen = () => {
        delay = 2000;
        ping = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "ping" })), 30000);
      };
      socket.onmessage = (e) => {
        let data;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (data.type === "pong") return;
        handler.current?.(data);
        window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: data }));
      };
      socket.onclose = async (e) => {
        clearInterval(ping);
        if (stopped) return;
        if (e.code === NOT_LOGGED_IN) {
          const still = await api("/auth/profile/").then(() => true).catch(() => false);
          if (!still) return;
        }
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30000);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      socket?.close();
    };
  }, [user]);
}
