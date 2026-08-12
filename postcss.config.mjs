/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 handles vendor prefixing itself — autoprefixer is no longer needed.
    '@tailwindcss/postcss': {},
  },
};

export default config;
