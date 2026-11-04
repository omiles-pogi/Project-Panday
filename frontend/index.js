// react-native-css-interop wires up `className` for every core component the first time it loads, and
// reading ImageBackground (which this app never uses) trips React Native's deprecation warning. It
// happens during the very first render, before any screen runs, so this has to be hidden here, ahead
// of expo-router's entry. NativeWind 4.2.7 is the latest stable release and v5 needs Tailwind 4, so
// there is no upgrade to take instead.
const { LogBox } = require("react-native");

LogBox.ignoreLogs(["ImageBackground is deprecated"]);

require("expo-router/entry");
