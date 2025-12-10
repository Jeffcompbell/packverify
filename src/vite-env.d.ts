/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PACKY_API_KEY: string
    readonly VITE_PACKY_BASE_URL: string
    readonly VITE_ZENMUX_API_KEY: string
    readonly VITE_ZENMUX_BASE_URL: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
