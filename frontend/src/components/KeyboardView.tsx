import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Platform, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Keeps its content above the on-screen keyboard so what the user types stays visible.
 *
 * Measures how far this view's bottom edge sits below the keyboard's top edge and pads by exactly
 * that. Unlike KeyboardAvoidingView it works inside tab bars/headers/modals and on edge-to-edge
 * Android, and never double-shifts if the OS already resized the window (overlap is then 0).
 */
export default function KeyboardView({
  children,
  className = "flex-1 bg-background",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);
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
