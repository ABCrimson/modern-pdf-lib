import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Modern PDF',
  description:
    'A modern, WASM-accelerated PDF creation engine for every JavaScript runtime',
  base: '/modern-pdf-lib/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#7C3AED' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'Modern PDF — WASM-Accelerated PDF Creation',
      },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A modern, WASM-accelerated PDF creation engine for every JavaScript runtime',
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      {
        property: 'og:url',
        content: 'https://abcrimson.github.io/modern-pdf-lib/',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    ],
    [
      'link',
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: '',
      },
    ],
  ],

  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [/\/api\//],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Modern PDF',

    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Migration', link: '/migration/from-pdf-lib' },
      { text: 'Playground', link: '/playground/' },
      {
        text: 'v0.19.9',
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/ABCrimson/modern-pdf-lib/blob/master/CHANGELOG.md',
          },
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/modern-pdf-lib',
          },
        ],
      },
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
            { text: 'Table Layout', link: '/guide/tables' },
            { text: 'Coordinates', link: '/guide/coordinates' },
            { text: 'Streaming', link: '/guide/streaming' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Image Optimization', link: '/guide/image-optimization' },
            { text: 'Annotations', link: '/guide/annotations' },
            { text: 'Barcodes & QR Codes', link: '/guide/barcodes' },
            { text: 'Signatures', link: '/guide/signatures' },
            { text: 'Accessibility', link: '/guide/accessibility' },
            { text: 'Cookbook', link: '/guide/cookbook' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Browser Integration', link: '/guide/browser' },
            { text: 'Content Security Policy', link: '/guide/csp' },
            { text: 'PDF/A Compliance', link: '/guide/pdfa' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [{ text: 'Overview', link: '/api/' }],
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
      {
        icon: 'github',
        link: 'https://github.com/ABCrimson/modern-pdf-lib',
      },
      { icon: 'npm', link: 'https://www.npmjs.com/package/modern-pdf-lib' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern:
        'https://github.com/ABCrimson/modern-pdf-lib/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026-present Modern PDF Contributors',
    },
  },
});
