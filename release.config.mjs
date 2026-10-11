export const commitOptions = { preset: 'conventionalcommits' };

export default {
  branches: ['main'],
  repositoryUrl: 'https://github.com/thulioph/deskercise.git',
  tagFormat: 'v${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', commitOptions],
    ['@semantic-release/release-notes-generator', commitOptions],
    ['./scripts/semantic-release-plugin.mjs', { npmPublish: true }],
  ],
};
