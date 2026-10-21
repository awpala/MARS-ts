/** @type {import("prettier").Config} */
const config = {
  // Indent with spaces everywhere; tabs are never used in this project.
  useTabs: false,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100,
  plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
  overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],
  tailwindStylesheet: './src/routes/layout.css'
};

export default config;
