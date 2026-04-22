export default defineNuxtConfig({
  extends: ['docus'],

  compatibilityDate: '2025-01-23',

  css: ['~/assets/css/custom.css'],

  mdc: {
    components: {
      map: {
        pre: 'CustomPre',
      },
    },
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },

  llms: {
    domain: 'https://supaslidev-docs.vercel.app',
    title: 'Supaslidev',
    description: 'A monorepo toolkit for managing multiple Slidev presentations with ease.',
  },

  $production: {
    mcp: { enabled: false },
    ogImage: { enabled: false },
  },

  mcp: {
    enabled: false,
  },
});
