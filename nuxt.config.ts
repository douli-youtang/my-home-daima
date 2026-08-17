// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  ssr: false,
  modules: ["@element-plus/nuxt"],
  css: ["~/assets/styles/mi-theme.css"],
  elementPlus: {
    importStyle: "css",
    defaultLocale: "zh-cn",
  },
  imports: {
    presets: [
      {
        from: "element-plus",
        imports: ["ElMessage", "ElMessageBox", "ElNotification", "ElLoading"],
      },
    ],
  },
  app: {
    head: {
      title: "扫码填表系统",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
        { name: "theme-color", content: "#FF6900" },
      ],
      link: [
        {
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/misans@4.0.0/lib/Normal/MiSans-Regular.min.css",
        },
      ],
    },
    pageTransition: { name: "mi-page", mode: "out-in" },
  },
  runtimeConfig: {
    // server-only from .env
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  vite: {
    server: {
      // Sealos / 反向代理域名；前导 `.` 表示允许该域名及其所有子域
      allowedHosts: [
        ".sealoshzh.site",
        "fwqrqpovrllb.sealoshzh.site",
      ],
    },
    optimizeDeps: {
      include: ["dayjs", "echarts", "vue-echarts", "html5-qrcode"],
    },
  },
  devServer: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 8080),
  },
  alias: {
    "@": ".",
  },
});
