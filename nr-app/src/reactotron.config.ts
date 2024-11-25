import Reactotron from "reactotron-react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// Reactotron.setAsyncStorageHandler(AsyncStorage)
Reactotron.configure({
  name: "Nostroots",
})
  .useReactNative({
    asyncStorage: false, // there are more options to the async storage.
    // networking: {
    //   // optionally, you can turn it off with false.
    //   // ignoreUrls: /symbolicate/,
    // },
    networking: true,
    editor: false, // there are more options to editor
    // errors: { veto: (stackFrame) => false }, // or turn it off with false
    errors: true,
    overlay: false, // just turning off overlay
  })
  .connect();
