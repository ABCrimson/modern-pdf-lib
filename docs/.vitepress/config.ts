import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Modern PDF',
  description: 'A modern, WASM-accelerated PDF creation engine',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#3451b2' }],
    [
      'meta',
      {
        name: 'og:description',
        content:
          'A modern, WASM-accelerated PDF creation engine for every JavaScript runtime',
      },
    ],
    ['meta', { name: 'og:type', content: 'website' }],
  ],

  lastUpdated: true,
  cleanUrls: true,

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/getting-started' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Migration', link: '/migration/from-pdf-lib' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Text', link: '/guide/text' },
            { text: 'Images', link: '/guide/images' },
            { text: 'Fonts', link: '/guide/fonts' },
            { text: 'Shapes', link: '/guide/shapes' },
            { text: 'Streaming', link: '/guide/streaming' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
          ],
        },
      ],
      '/migration/': [
        {
          text: 'Migration',
          items: [
            { text: 'From pdf-lib', link: '/migration/from-pdf-lib' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/user/modern-pdf' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/user/modern-pdf/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present Modern PDF Contributors',
    },
  },
});
