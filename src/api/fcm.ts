// Safe no-op FCM helper. Returning null avoids attempting to load native
// Firebase modules which may not be installed/configured and cause runtime
// errors like "Native module NativeRNFBTurboApp is not registered".
// To enable FCM, install and configure @react-native-firebase/app and
// @react-native-firebase/messaging and replace this implementation.
export const getFcmToken = async (): Promise<string | null> => {
  console.log('FCM disabled: not attempting to access native Firebase modules.');
  return null;
};
