import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserOrOrganizationSite = repositoryName.endsWith('.github.io');
const basePath = isGitHubPages && repositoryName && !isUserOrOrganizationSite
  ? `/${repositoryName}`
  : '';

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: 'export',
      basePath,
      trailingSlash: true,
    }
  : {};

export default nextConfig;
