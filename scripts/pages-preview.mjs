import { cp, mkdir, readdir, lstat, rm, access } from 'node:fs/promises';
import { join } from 'node:path';

export function previewPlan(pulls, repository, basePath) {
  const base = `${basePath.replace(/\/$/, '')}/`;
  return pulls.filter(pr => pr.state === 'open' && pr.head.repo?.full_name === repository && pr.base.ref === 'main')
    .map(pr => {
      if (!Number.isSafeInteger(pr.number) || pr.number < 1 || !/^[a-f0-9]{40}$/.test(pr.head.sha)) {
        throw new Error('Invalid preview identity');
      }
      return { number: pr.number, sha: pr.head.sha, base: `${base}pr-preview/${pr.number}/` };
    });
}

async function exists(path) {
  try { await access(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// Treat build artifacts as static files, never as executable deployment helpers.
async function validateFiles(path) {
  let size = 0;
  for (const name of await readdir(path)) {
    const file = join(path, name);
    const stat = await lstat(file);
    if (stat.isDirectory()) size += await validateFiles(file);
    else if (stat.isFile()) size += stat.size;
    else throw new Error(`Unsupported artifact entry: ${file}`);
  }
  return size;
}

export async function assembleSite(production, artifacts, output, previews, maxBytes = 900 * 1024 * 1024) {
  if (!await exists(join(production, 'index.html'))) throw new Error('Production build is missing');
  let bytes = await validateFiles(production);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(production, output, { recursive: true });
  // This namespace is always derived from the current list of open PRs.
  await rm(join(output, 'pr-preview'), { recursive: true, force: true });
  const published = [];
  for (const preview of previews) {
    if (!Number.isSafeInteger(preview.number) || preview.number < 1) throw new Error('Invalid PR number');
    const source = join(artifacts, `rain-preview-${preview.number}`);
    if (!await exists(join(source, 'index.html'))) continue;
    // A broken preview must not stop a healthy production deployment.
    try {
      const size = await validateFiles(source);
      if (bytes + size > maxBytes) throw new Error('Combined site would exceed the size budget');
      await cp(source, join(output, 'pr-preview', String(preview.number)), { recursive: true });
      bytes += size;
      published.push(preview);
    } catch (error) {
      await rm(join(output, 'pr-preview', String(preview.number)), { recursive: true, force: true });
      console.warn(`Skipping preview #${preview.number}: ${error.message}`);
    }
  }
  if (bytes > maxBytes) throw new Error('Production site exceeds the size budget');
  return published;
}

export function previewComment(preview, pageUrl, published) {
  const marker = '<!-- rain-pr-preview -->';
  const url = new URL(`pr-preview/${preview.number}/`, `${pageUrl.replace(/\/$/, '')}/`);
  return published
    ? `${marker}\nPreview: [Open website](${url.href})\n\nBuilt from \`${preview.sha}\`. Updates on new commits and is removed when this PR closes.`
    : `${marker}\nPreview unavailable for \`${preview.sha}\`: the build failed or could not be included. Check the Pages workflow. The production site was published independently.`;
}

export async function updatePreviewComment(github, repo, number, body) {
  const comments = await github.paginate(github.rest.issues.listComments, { ...repo, issue_number: number, per_page: 100 });
  const previous = comments.find(comment => comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith('<!-- rain-pr-preview -->'));
  if (previous) {
    if (previous.body !== body) await github.rest.issues.updateComment({ ...repo, comment_id: previous.id, body });
  } else {
    await github.rest.issues.createComment({ ...repo, issue_number: number, body });
  }
}
