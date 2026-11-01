import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

/**
 * Keeps its content above the on-screen keyboard so what the user types stays visible.
 *
 * Uses react-native-keyboard-controller (bundled with Expo Go; <KeyboardProvider> is mounted in the
 * root layout), which reads the keyboard's real position from the OS on both platforms, follows its
 * animation frame by frame, and accounts for headers and tab bars via `automaticOffset`.
 *
 * `modal` is for content inside a React Native <Modal> (see Sheet): on Android that is a separate
 * window the provider doesn't see, so it keeps the older measure-and-pad approach instead.
 */
export default function KeyboardView({
  children,
  className = "flex-1 bg-background",
  style,
  modal = false,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  modal?: boolean;
}) {
  if (modal) {
    return (
      <MeasuredKeyboardView className={className} style={style}>
        {children}
      </MeasuredKeyboardView>
    );
  }

  return (
    <View className={className} style={style}>
      <KeyboardAvoidingView behavior="padding" automaticOffset style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Measures how far this view's bottom edge sits below the keyboard's top edge and pads by exactly
 * that. Works inside modals because it only needs the RN keyboard events for its own window, and
 * never double-shifts if the OS already resized the window (overlap is then 0).
 */
function MeasuredKeyboardView({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, height) => {
        setInset(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} className={className} style={[style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}
