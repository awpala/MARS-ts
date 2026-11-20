/* Ports mars/venus/RepeatButton.java, adapted by DPS from bsampieri’s 2004 Java Developer Forum example. Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
/** Repeat a held primary pointer click after 300 ms and every 60 ms thereafter. Native clicks still handle release and keyboard activation. */
export function repeatPress(button: HTMLButtonElement): () => void {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let timer: ReturnType<typeof setTimeout>;
  let pointer: number | null = null;
  function stop() {
    clearTimeout(timer);
    pointer = null;
  }
  function repeat() {
    if (button.disabled) return stop();
    button.click();
    timer = setTimeout(repeat, 60);
  }
  button.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || !event.isPrimary || button.disabled) return;
      stop();
      pointer = event.pointerId;
      timer = setTimeout(repeat, 300);
    },
    options
  );
  button.addEventListener('pointerleave', () => clearTimeout(timer), options);
  button.addEventListener(
    'pointerenter',
    (event) => {
      if (pointer === event.pointerId && event.buttons & 1) {
        clearTimeout(timer);
        timer = setTimeout(repeat, 60);
      }
    },
    options
  );
  function released(event: PointerEvent) {
    if (pointer === event.pointerId) stop();
  }
  window.addEventListener('pointerup', released, options);
  window.addEventListener('pointercancel', released, options);
  window.addEventListener('blur', stop, options);
  return () => {
    stop();
    listeners.abort();
  };
}
