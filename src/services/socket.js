import { Client } from "@stomp/stompjs";
import { WS_BASE_URL } from "./api";

let client = null;
let connectPromise = null;

/*
 * Subscription registry.
 *
 * Keyed by destination (not by an opaque id), so that:
 *  - Every registered destination is automatically re-subscribed after
 *    any (re)connect, including stompjs's own automatic reconnects
 *    (reconnectDelay) and any manual connectSocket() call after an
 *    explicit disconnectSocket() (e.g. app foreground/background).
 *  - A second subscribeTopic() call for the same destination replaces
 *    the previous one instead of stacking a duplicate live
 *    subscription on top of it (prevents double-delivery).
 *
 * entry shape: { token, callback, stompSub }
 *   token   - increases each time a destination is (re)claimed, so a
 *             stale caller's returned unsubscribe() can't accidentally
 *             tear down a newer subscriber's subscription to the same
 *             destination.
 *   stompSub - the live @stomp/stompjs subscription object for the
 *             CURRENT connection, or null if we're currently
 *             disconnected / haven't (re)subscribed yet.
 */
const subscriptionRegistry = new Map();
let subscriptionTokenSeq = 0;

/**
 * Convert backend HTTP/HTTPS URL to WebSocket URL.
 *
 * Examples:
 * https://your-backend.onrender.com/ws
 *        -> wss://your-backend.onrender.com/ws
 *
 * https://your-backend.onrender.com
 *        -> wss://your-backend.onrender.com/ws
 */
function toWebSocketUrl(baseUrl) {
  if (!baseUrl) {
    throw new Error("WS_BASE_URL is not configured");
  }

  let url = baseUrl.trim();

  url = url.replace(/^https:\/\//i, "wss://");
  url = url.replace(/^http:\/\//i, "ws://");

  // Remove trailing slash
  url = url.replace(/\/+$/, "");

  // Your Spring WebSocket endpoint
  if (!url.endsWith("/ws") && !url.endsWith("/websocket")) {
    url += "/ws";
  }

  return url;
}

/**
 * Wrap a user callback into a STOMP frame handler that parses the JSON
 * body and reports which destination it came from in logs - same
 * parsing/logging behavior as before, just factored out so both the
 * initial subscribe and every resubscribe-on-reconnect use identically
 * behaving handlers.
 */
function makeFrameHandler(destination, callback) {
  return (frame) => {
    try {
      const data = JSON.parse(frame.body);

      console.log("📩 STOMP message:", destination, data);

      callback(data);
    } catch (error) {
      console.error("❌ Failed to parse STOMP message:", error);
      console.log("Raw frame:", frame.body);
    }
  };
}

/**
 * Re-issue every registered subscription against a freshly (re)connected
 * STOMP client. Called once inside onConnect, so it covers both the
 * very first connect and every automatic reconnect afterward.
 */
function resubscribeAll(stompClient) {
  if (subscriptionRegistry.size === 0) {
    return;
  }

  console.log(
    "🔁 Restoring",
    subscriptionRegistry.size,
    "STOMP subscription(s) after (re)connect"
  );

  subscriptionRegistry.forEach((entry, destination) => {
    try {
      entry.stompSub = stompClient.subscribe(
        destination,
        makeFrameHandler(destination, entry.callback)
      );

      console.log("📡 Restored subscription:", destination);
    } catch (error) {
      console.warn(
        "⚠️ Failed to restore subscription:",
        destination,
        error?.message
      );
    }
  });
}

/**
 * Connect to Spring STOMP WebSocket.
 */
export function connectSocket() {
  // Already connected
  if (client?.connected) {
    return Promise.resolve(client);
  }

  // Connection already in progress
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = new Promise((resolve, reject) => {
    try {
      const wsUrl = toWebSocketUrl(WS_BASE_URL);

      console.log("=================================");
      console.log("Connecting STOMP WebSocket");
      console.log("WebSocket URL:", wsUrl);
      console.log("=================================");

      const stompClient = new Client({
        webSocketFactory: () => {
          console.log("Creating WebSocket:", wsUrl);
          return new WebSocket(wsUrl);
        },

        reconnectDelay: 5000,

        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        debug: (message) => {
          if (__DEV__) {
            console.log("[STOMP]", message);
          }
        },

        onConnect: () => {
          console.log("✅ STOMP CONNECTED");

          client = stompClient;
          connectPromise = null;

          // This is the actual reliability fix: restore every
          // previously-registered subscription on every (re)connect,
          // not just the first one. Without this, ChatScreen's and
          // CallContext's subscriptions silently stop receiving
          // anything after any reconnect (network blip, or the
          // explicit disconnect/reconnect SocketContext does on
          // app background/foreground).
          resubscribeAll(stompClient);

          resolve(stompClient);
        },

        onStompError: (frame) => {
          console.error("❌ STOMP broker error:", frame.headers?.message);

          console.error("STOMP details:", frame.body);
        },

        onWebSocketError: (event) => {
          console.error("❌ WebSocket error:", event);
        },

        onWebSocketClose: (event) => {
          console.warn("⚠️ WebSocket closed:", event?.code, event?.reason);

          // Don't manually reconnect here.
          // @stomp/stompjs handles reconnectDelay, and onConnect above
          // handles restoring subscriptions once it reconnects.
        },

        onDisconnect: () => {
          console.log("STOMP disconnected");
        },
      });

      client = stompClient;

      stompClient.activate();
    } catch (error) {
      console.error("❌ Failed to initialize STOMP:", error);

      connectPromise = null;
      client = null;

      reject(error);
    }
  });

  return connectPromise;
}

/**
 * Disconnect WebSocket/STOMP.
 *
 * Note: this intentionally does NOT clear subscriptionRegistry. The
 * whole point of the registry is that a later connectSocket() call
 * (e.g. SocketContext reconnecting on app foreground) can restore every
 * subscription automatically via resubscribeAll() in onConnect, without
 * ChatScreen/CallContext needing to know a disconnect ever happened.
 */
export async function disconnectSocket() {
  connectPromise = null;

  // The live per-connection subscription objects are no longer valid
  // once we deactivate - clear them so nothing holds a stale reference.
  // The registrations themselves (destination + callback) are kept.
  subscriptionRegistry.forEach((entry) => {
    entry.stompSub = null;
  });

  if (!client) {
    return;
  }

  const currentClient = client;

  client = null;

  try {
    if (currentClient.active) {
      await currentClient.deactivate();
    }
  } catch (error) {
    console.warn("⚠️ Error while disconnecting STOMP:", error?.message);
  }
}

/**
 * Subscribe to a STOMP topic.
 *
 * Example:
 * subscribeTopic(
 *   `/topic/messages/${userId}`,
 *   callback
 * );
 *
 * Registers the destination so it automatically survives any future
 * reconnect. If a subscription already exists for this exact
 * destination, it is replaced (old one torn down first) rather than
 * stacked, so the same topic is never delivered twice to two live
 * subscriptions.
 *
 * Returns an unsubscribe function. Calling it only tears down the
 * subscription if it's still the current owner of that destination -
 * if something else has since replaced it, the call is a safe no-op,
 * so a stale caller can never accidentally remove a newer subscriber's
 * subscription.
 */
export async function subscribeTopic(destination, callback) {
  const activeClient = await connectSocket();

  const previous = subscriptionRegistry.get(destination);
  if (previous?.stompSub) {
    try {
      previous.stompSub.unsubscribe();
    } catch (error) {
      console.warn(
        "⚠️ Failed to unsubscribe previous subscription:",
        destination,
        error?.message
      );
    }
  }

  const token = ++subscriptionTokenSeq;
  const entry = { token, callback, stompSub: null };
  subscriptionRegistry.set(destination, entry);

  if (activeClient?.connected) {
    console.log("📡 Subscribing to:", destination);

    entry.stompSub = activeClient.subscribe(
      destination,
      makeFrameHandler(destination, callback)
    );
  } else {
    // Not connected right this instant (rare race between
    // connectSocket() resolving and the connection dropping again
    // immediately). Don't fail the caller - the registration above is
    // enough; resubscribeAll() will pick it up on the next successful
    // connect.
    console.warn(
      "⚠️ Registered subscription while disconnected, will subscribe on next connect:",
      destination
    );
  }

  return () => {
    const current = subscriptionRegistry.get(destination);

    if (current && current.token === token) {
      try {
        current.stompSub?.unsubscribe();

        console.log("🔕 Unsubscribed:", destination);
      } catch (error) {
        console.warn("⚠️ Failed to unsubscribe:", error?.message);
      }

      subscriptionRegistry.delete(destination);
    }
  };
}

/**
 * Publish a STOMP message.
 *
 * Used for:
 * - chat messages
 * - call invite
 * - call answer
 * - ICE candidates
 * - call reject
 * - call end
 */
export async function publishMessage(destination, body) {
  const activeClient = await connectSocket();

  if (!activeClient?.connected) {
    throw new Error("STOMP client is not connected");
  }

  console.log("📤 STOMP publish:", destination, body);

  activeClient.publish({
    destination,
    body: JSON.stringify(body),
  });
}

/**
 * Check connection status.
 */
export function isSocketConnected() {
  return !!client?.connected;
}

/**
 * Get current STOMP client.
 * Useful for debugging.
 */
export function getSocketClient() {
  return client;
}