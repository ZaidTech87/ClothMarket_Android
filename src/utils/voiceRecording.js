import { Audio } from "expo-av";

// Replaces web Chat.jsx's `navigator.mediaDevices.getUserMedia({audio:true})`
// + `MediaRecorder` pair, which don't exist in React Native. expo-av's
// Audio.Recording is the native equivalent; output is an .m4a file
// instead of the web version's .webm blob, but both are just "audioFile"
// by the time they reach messageAPI.sendVoiceMessage, which the backend
// accepts as an opaque MultipartFile regardless of container format.
let recordingInstance = null;

export async function requestMicPermission() {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

export async function startVoiceRecording() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recordingInstance = recording;
  return recording;
}

// Returns a { uri, name, type } asset ready to hand to messageAPI.sendVoiceMessage,
// mirroring the shape used everywhere else file uploads happen in this app.
export async function stopVoiceRecording() {
  if (!recordingInstance) return null;
  await recordingInstance.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = recordingInstance.getURI();
  recordingInstance = null;
  if (!uri) return null;
  return { uri, name: "voice-message.m4a", type: "audio/m4a" };
}

export function cancelVoiceRecording() {
  if (recordingInstance) {
    recordingInstance.stopAndUnloadAsync().catch(() => {});
    recordingInstance = null;
  }
}
