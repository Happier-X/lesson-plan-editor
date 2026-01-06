// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    public: {
      openaiApiKey: process.env.NUXT_PUBLIC_OPENAI_API_KEY,
      openaiBaseUrl: process.env.NUXT_PUBLIC_OPENAI_BASE_URL,
      openaiModel: process.env.NUXT_PUBLIC_OPENAI_MODEL,
    }
  }
});
