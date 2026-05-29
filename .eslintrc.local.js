'use strict'

// Allow lib/ and bin/ to require devDependencies. The RFC automation tooling is
// itself dev tooling — it runs in CI and via local scripts, never shipped to
// consumers (npm/rfcs has no published runtime artifact).
module.exports = {
  overrides: [
    {
      files: ['lib/**/*.js', 'bin/**/*.js'],
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
  ],
}
