const configured = import.meta.env.VITE_FEATURE_POKE_DEMO_MODE;

export const FEATURE_POKE_DEMO_MODE = configured === undefined
  ? import.meta.env.DEV
  : configured === 'true';
