'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the on-screen keyboard is open, so `MobileNav` can step out of the
 * way of the field being filled in (the profile form).
 *
 * iOS does not shrink the layout viewport when the keyboard opens, only the
 * *visual* viewport, and neither `100dvh` nor a media query sees the keyboard
 * at all. `visualViewport` is what reports it, and it is an external store, so
 * it is read through `useSyncExternalStore` rather than an effect that writes
 * state. `offsetTop` is how far the browser has already scrolled the layout
 * viewport to reveal a focused field, and it is added back so the overlap is
 * not double-counted while the page is scrolled.
 *
 * Ported from Veldboek's `use-keyboard-inset`, less the pixel values nothing
 * here reads.
 */

// A few pixels of slack: the two viewports disagree by a fraction while the
// browser is mid-scroll, and a 1px "keyboard" would hide the bar for nothing.
const KEYBOARD_MIN_HEIGHT = 24;

function getSnapshot(): boolean {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  const covered = window.innerHeight - viewport.height - viewport.offsetTop;
  return covered > KEYBOARD_MIN_HEIGHT;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener('resize', onStoreChange);
  viewport.addEventListener('scroll', onStoreChange);
  return () => {
    viewport.removeEventListener('resize', onStoreChange);
    viewport.removeEventListener('scroll', onStoreChange);
  };
}

export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
