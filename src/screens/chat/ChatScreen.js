// [... all imports unchanged ...]

export default function ChatScreen({ route, navigation }) {
  const { receiverId, userName } = route.params || {};

  const { user } = useAuth();
  const { subscribeTopic } = useSocket();
  const { startCall, callStatus } = useCall();

  // [... all state/refs unchanged ...]

  // --------------------------------------------------
  // REALTIME MESSAGE SUBSCRIPTION
  // --------------------------------------------------
  // Unchanged - this was already correctly guarded against the
  // unmount-before-resolve race via the `cancelled` flag below. The
  // reason messages weren't reliably arriving live wasn't anything in
  // this effect - it was that services/socket.js had no mechanism to
  // re-issue this subscription after a STOMP reconnect. That's now
  // fixed centrally in socket.js's subscription registry, so this
  // effect needs no changes: it subscribes once per (user, receiverId)
  // pair, and socket.js keeps that subscription alive across any
  // number of reconnects for as long as this effect hasn't cleaned up.

  useEffect(() => {
    if (!user?.userId || !receiverId) {
      return;
    }

    let unsubscribe = null;
    let cancelled = false;

    const topic = `/topic/messages/${user.userId}`;

    const setupSubscription = async () => {
      try {
        const removeSubscription = await subscribeTopic(
          topic,
          async (incoming) => {
            if (cancelled || !incoming) return;

            const senderId = incoming.senderId;
            const incomingReceiverId =
              incoming.receiverId;

            const belongsToConversation =
              String(senderId) === String(receiverId) ||
              String(incomingReceiverId) === String(receiverId);

            if (!belongsToConversation) {
              return;
            }

            setMessages((previous) => {
              const incomingId = incoming.id;

              if (
                incomingId != null &&
                previous.some(
                  (message) =>
                    String(message.id) ===
                    String(incomingId)
                )
              ) {
                return previous;
              }

              return [...previous, incoming];
            });

            if (
              String(senderId) ===
              String(receiverId)
            ) {
              try {
                await messageAPI.markAsRead(receiverId);
              } catch (error) {
                console.warn(
                  "markAsRead failed:",
                  error?.message
                );
              }
            }

            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({
                animated: true,
              });
            });
          }
        );

        if (!cancelled) {
          unsubscribe = removeSubscription;
        } else {
          removeSubscription?.();
        }
      } catch (error) {
        console.warn(
          "STOMP message subscription failed:",
          error?.message
        );
      }
    };

    setupSubscription();

    return () => {
      cancelled = true;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Subscription cleanup failed:",
          error?.message
        );
      }
    };
  }, [
    user?.userId,
    receiverId,
    subscribeTopic,
  ]);

  // [... everything else in the file - handleSend, voice recording,
  //      call buttons, the entire render/UI, all styles - unchanged ...]
}