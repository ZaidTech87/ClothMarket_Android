# ClothMarket Android — Manual Testing Checklist

Everything below needs a real device or emulator to confirm. What could be checked without one (syntax, imports, dependency resolution, `expo prebuild` output) already was, phase by phase, during development — this list is what's left.

## Auth
- [ ] Signup with a new mobile number → lands on Feed
- [ ] Signup with a duplicate mobile number → shows backend's error message
- [ ] Login with correct credentials → lands on Feed
- [ ] Login with wrong password → shows error, stays on Login
- [ ] Logout (Profile tab) → confirm dialog → returns to Login
- [ ] Force-quit and reopen app after logging in → still logged in (session persisted)
- [ ] Forgot password → check backend console for OTP → Reset password → can log in with new password
- [ ] Manually corrupt/expire the stored token → next API call 401s → auto-returns to Login

## Feed & Posts
- [ ] Feed loads and scrolls
- [ ] Scrolling to the bottom loads page 2+ (pagination)
- [ ] Pull-to-refresh on Feed
- [ ] Create post with an image → appears in Feed
- [ ] Create post with a video → appears in Feed, plays inline
- [ ] Create post with no media → still succeeds (media is optional)
- [ ] Delete your own post → disappears from Feed
- [ ] Delete button does NOT appear on other users' posts
- [ ] Tap a post's description "See more/less" toggle

## Profile
- [ ] Own profile shows your posts, mobile number, location
- [ ] Tap another user's name/avatar anywhere → navigates to their profile (no mobile number shown, no delete buttons)
- [ ] Change profile picture → uploads, updates immediately
- [ ] Search for a user by name → tap a result → navigates to their profile
- [ ] Pull-to-refresh on Profile

## Messaging
- [ ] Messages tab lists conversations with correct last-message preview and unread badge
- [ ] Open a chat → history loads, marks as read (badge clears)
- [ ] Send a text message → appears immediately, received on the other device
- [ ] Record and send a voice message (mic permission prompt on first use) → plays back on tap
- [ ] Tap the header avatar in a chat → navigates to that user's profile

## Real-time (WebSocket/STOMP)
- [ ] Two devices, same chat: message sent on device A appears on device B within ~1s (not waiting for the slow poll)
- [ ] Turn off Wi-Fi mid-chat → turn it back on → reconnects, messages resume
- [ ] Switch Wi-Fi → mobile data mid-chat → reconnects
- [ ] Background the app for 30+ seconds → foreground it → reconnects, no duplicate or missing messages

## Calling (requires the native build — see README §6)
- [ ] Start an audio call → other device sees incoming call UI
- [ ] Accept → both sides hear each other
- [ ] Reject → both sides return to idle, no crash
- [ ] Start a video call → local + remote video render correctly
- [ ] Mute toggle → other side stops hearing you
- [ ] Camera toggle (video call) → other side sees your video freeze/go blank appropriately
- [ ] End call mid-conversation from either side → both devices clean up (no stuck video surface, no dangling connection)
- [ ] Camera/mic permission prompts appear on first call attempt, not before

## Chatbot
- [ ] Floating bubble opens/closes
- [ ] Send a message → typing indicator → reply renders
- [ ] Ask something unrelated to the app/textiles → gets the "I can only help with..." redirect (per the backend's system prompt)
- [ ] Bubble is hidden behind an active call, reappears after the call ends

## Android-specific
- [ ] Hardware back button pops screens correctly throughout the app
- [ ] On the Feed tab (root), back button shows "press again to exit" toast, then exits on second press within 2s
- [ ] Keyboard doesn't obscure input fields on any form (auth screens, chat, create post, chatbot)
- [ ] App survives being killed and reopened without crashing
- [ ] Recording a voice message, then pressing back mid-recording → recording is cancelled, no crash, no orphaned session

## Network failure handling
- [ ] Turn off all connectivity, try to log in → shows a reasonable error, not a silent hang or crash
- [ ] Turn off connectivity mid-Feed-scroll → pagination fails gracefully, pull-to-refresh lets you retry
