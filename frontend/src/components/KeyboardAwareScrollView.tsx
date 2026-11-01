import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

/** Clear space left between the focused field and the keyboard / top edge. */
const MARGIN = 24;
/** How often to check whether focus jumped to another field while the keyboard stays open. */
const FOCUS_POLL_MS = 250;

/**
 * A ScrollView that keeps the field being typed into visible above the keyboard.
 *
 * KeyboardView shrinks the screen to sit above the keyboard, but a field that was lower in the
 * scrolling content is still off-screen after that — nothing scrolls to it. This does: when the
 * keyboard opens (the ScrollView's own height changes), or focus moves to another field while it's
 * open, it scrolls just far enough to bring the focused input fully into view. Use it in place of
 * ScrollView anywhere a form or text field lives inside the scrolling content.
 */
export default function KeyboardAwareScrollView({ onScroll, onLayout, ...props }: ScrollViewProps) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const viewHeight = useRef(0);
  const keyboardOpen = useRef(false);
  const lastFocused = useRef<unknown>(null);

  const ensureFocusedVisible = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const content = ref.current?.getInnerViewRef();
    if (!input || !content || viewHeight.current === 0) return;

    // Fails (error callback, ignored) for an input that isn't inside this ScrollView — e.g. a chat
    // composer pinned below the list — which is exactly the case where nothing should scroll.
    input.measureLayout(
      content,
      (_x, y, _width, height) => {
        const top = y - MARGIN;
        const bottom = y + height + MARGIN;
        if (bottom > offset.current + viewHeight.current) {
          ref.current?.scrollTo({ y: Math.max(0, Math.min(top, bottom - viewHeight.current)), animated: true });
        } else if (top < offset.current) {
          ref.current?.scrollTo({ y: Math.max(0, top), animated: true });
        }
      },
      () => undefined
    );
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    let poll: ReturnType<typeof setInterval> | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const show = Keyboard.addListener(showEvent, () => {
      keyboardOpen.current = true;
      lastFocused.current = TextInput.State.currentlyFocusedInput();
      // The ScrollView's onLayout below does the main work once the screen has shrunk; this covers
      // the case where the OS already resized the window and no further layout happens.
      clearTimeout(settle);
      settle = setTimeout(ensureFocusedVisible, 120);
      clearInterval(poll);
      poll = setInterval(() => {
        const focused = TextInput.State.currentlyFocusedInput();
        if (focused && focused !== lastFocused.current) {
          lastFocused.current = focused;
          ensureFocusedVisible();
        }
      }, FOCUS_POLL_MS);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardOpen.current = false;
      lastFocused.current = null;
      clearInterval(poll);
      clearTimeout(settle);
    });

    return () => {
      show.remove();
      hide.remove();
      clearInterval(poll);
      clearTimeout(settle);
    };
  }, [ensureFocusedVisible]);

  const layoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(layoutTimer.current), []);

  const handleLayout = (e: LayoutChangeEvent) => {
    viewHeight.current = e.nativeEvent.layout.height;
    if (keyboardOpen.current) {
      // The screen resizes frame by frame while the keyboard animates; wait for it to settle
      // instead of firing a scroll on every frame.
      clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(ensureFocusedVisible, 80);
    }
    onLayout?.(e);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...props}
      ref={ref}
      onLayout={handleLayout}
      onScroll={handleScroll}
    />
  );
}
