module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
      },
    ],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    // Le dépôt utilise déjà un style non strictement "google" sur index.js.
    // On assouplit quelques règles de formatage pour garder un lint signal/bruit raisonnable.
    "indent": "off",
    "object-curly-spacing": "off",
    "operator-linebreak": "off",
    "comma-dangle": "off",
    "quote-props": "off",
    "valid-jsdoc": "off",
    "max-len": [
      "error",
      {
        "code": 100,
        "ignoreComments": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
      },
    ],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
