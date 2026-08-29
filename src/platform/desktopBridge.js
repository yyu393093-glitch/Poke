const desktop = window.pokeDesktop;
const noopUnsubscribe = () => {};
export const desktopBridge = {
  isDesktop: () => Boolean(desktop?.isDesktop),
  openMain: () => desktop?.openMain?.() ?? Promise.resolve(false),
  petSetExpanded: (expanded) => desktop?.petSetExpanded?.(expanded) ?? Promise.resolve(Boolean(expanded)),
  petOpenMenu: () => desktop?.petOpenMenu?.() ?? undefined,
  petReset: () => desktop?.petReset?.() ?? Promise.resolve(null),
  petSetPaused: (paused) => desktop?.petSetPaused?.(paused) ?? Promise.resolve(Boolean(paused)),
  updatePetProgress: (progress) => desktop?.updatePetProgress?.(progress) ?? Promise.resolve(progress),
  onPetProgress: (listener) => desktop?.onPetProgress?.(listener) ?? noopUnsubscribe,
  onPetPaused: (listener) => desktop?.onPetPaused?.(listener) ?? noopUnsubscribe,
  onPetLoadError: (listener) => desktop?.onPetLoadError?.(listener) ?? noopUnsubscribe,
  onPetPopupSide: (listener) => desktop?.onPetPopupSide?.(listener) ?? noopUnsubscribe,
  openAssistant: () => desktop?.openAssistant?.() ?? Promise.resolve(false),
  toggleAssistant: () => desktop?.toggleAssistant?.() ?? Promise.resolve(false),
  setAssistantAlwaysOnTop: (enabled) => desktop?.setAssistantAlwaysOnTop?.(enabled) ?? Promise.resolve(Boolean(enabled)),
  sendPoke: (payload) => desktop?.sendPoke?.(payload) ?? Promise.resolve(null),
  sendChat: (payload) => desktop?.sendChat?.(payload) ?? Promise.resolve(null),
  onPokeReceived: (listener) => desktop?.onPokeReceived?.(listener) ?? noopUnsubscribe,
  onSessionUpdated: (listener) => desktop?.onSessionUpdated?.(listener) ?? noopUnsubscribe,
};
