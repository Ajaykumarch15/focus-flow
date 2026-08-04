/// <reference types="vite/client" />

// IES-P0-22: Vite env contract. VITE_API_URL is required (build fails without it).
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
