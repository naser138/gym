// Extends app.json. EXPO_BASE_URL lets the web build live under a sub-path,
// e.g. GitHub Pages project sites: https://USERNAME.github.io/my-gym/  →  EXPO_BASE_URL=/my-gym
module.exports = ({ config }) => ({
  ...config,
  web: {
    ...config.web,
    output: 'single',
    bundler: 'metro',
    name: 'My Gym',
    shortName: 'My Gym',
    lang: 'ar',
    themeColor: '#090D12',
    backgroundColor: '#090D12',
  },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
