import { Client } from "@stomp/stompjs";
import { WS_BASE_URL } from "./api";

let client = null;
let connectPromise = null;

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

          resolve(stompClient);
        },

        onStompError: (frame) => {
          console.error(
            "❌ STOMP broker error:",
            frame.headers?.message
          );

          console.error(
            "STOMP details:",
            frame.body
          );
        },

        onWebSocketError: (event) => {
          console.error(
            "❌ WebSocket error:",
            event
          );
        },

        onWebSocketClose: (event) => {
          console.warn(
            "⚠️ WebSocket closed:",
            event?.code,
            event?.reason
          );

          // Don't manually reconnect here.
          // @stomp/stompjs handles reconnectDelay.
        },

        onDisconnect: () => {
          console.log("STOMP disconnected");
        },
      });

      client = stompClient;

      stompClient.activate();
    } catch (error) {
      console.error(
        "❌ Failed to initialize STOMP:",
        error
      );

      connectPromise = null;
      client = null;

      reject(error);
    }
  });

  return connectPromise;
}

/**
 * Disconnect WebSocket/STOMP.
 */
export async function disconnectSocket() {
  connectPromise = null;

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
    console.warn(
      "⚠️ Error while disconnecting STOMP:",
      error?.message
    );
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
 */
export async function subscribeTopic(destination, callback) {
  const activeClient = await connectSocket();

  if (!activeClient?.connected) {
    throw new Error(
      "STOMP client is not connected"
    );
  }

  console.log(
    "📡 Subscribing to:",
    destination
  );

  const subscription = activeClient.subscribe(
    destination,
    (frame) => {
      try {
        const data = JSON.parse(frame.body);

        console.log(
          "📩 STOMP message:",
          destination,
          data
        );

        callback(data);
      } catch (error) {
        console.error(
          "❌ Failed to parse STOMP message:",
          error
        );

        console.log(
          "Raw frame:",
          frame.body
        );
      }
    }
  );

  return () => {
    try {
      subscription.unsubscribe();

      console.log(
        "🔕 Unsubscribed:",
        destination
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to unsubscribe:",
        error?.message
      );
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
    throw new Error(
      "STOMP client is not connected"
    );
  }

  console.log(
    "📤 STOMP publish:",
    destination,
    body
  );

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