import { defineConfig } from 'astro/config';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'cdsphoto.github.io';
const isUserSite = repoName.endsWith('.github.io');

export default defineConfig({
  site: process.env.SITE_URL || 'https://cdsphoto.github.io',
  base: process.env.BASE_PATH || (isUserSite ? '/' : `/${repoName}`),
  output: 'static',
});
