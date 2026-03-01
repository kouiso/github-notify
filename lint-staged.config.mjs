export default {
  '*.{js,jsx,ts,tsx}': ['biome check --fix --no-errors-on-unmatched', 'eslint --fix'],
  '*.{json,css}': ['biome check --fix --no-errors-on-unmatched'],
};
