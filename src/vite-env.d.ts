/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLAIN_OAUTH_CLIENT_ID?: string;
  readonly VITE_PLAIN_API_URL?: string;
  readonly VITE_PLAIN_AUTH_URL?: string;
  readonly VITE_PLAIN_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
