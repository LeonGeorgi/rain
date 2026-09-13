import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { previewPlan, assembleSite, previewComment, updatePreviewComment } from '../scripts/pages-preview.mjs';

const sha = 'a'.repeat(40);
const pr = (number, overrides = {}) => ({number, state: 'open', base: {ref: 'main'}, head: {sha, repo: {full_name: 'LeonGeorgi/rain'}}, ...overrides});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'rain-pages-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const put = async (path, text = path) => {
    const file = join(root, path);
    await mkdir(join(file, '..'), {recursive: true});
    await writeFile(file, text);
  };
  await put('production/index.html', 'main');
  await put('production/data/stations.json', 'production data');
  return {root, put, run: (previews, budget) => assembleSite(join(root, 'production'), join(root, 'artifacts'), join(root, 'site'), previews, budget)};
}

test('preview plan supports custom-domain and project paths, excluding forks, closed PRs and other bases', () => {
  const pulls = [pr(1), pr(2, {state: 'closed'}), pr(3, {base: {ref: 'release'}}), pr(4, {head: {sha, repo: {full_name: 'other/rain'}}}), pr(5, {head: {sha, repo: null}})];
  assert.deepEqual(previewPlan(pulls, 'LeonGeorgi/rain', ''), [{number: 1, sha, base: '/pr-preview/1/'}]);
  for (const base of ['/rain', '/rain/']) assert.equal(previewPlan([pr(1)], 'LeonGeorgi/rain', base)[0].base, '/rain/pr-preview/1/');
  assert.throws(() => previewPlan([pr('../main')], 'LeonGeorgi/rain', ''), /Invalid/);
  assert.throws(() => previewPlan([pr(1, {head: {sha: 'branch-name', repo: {full_name: 'LeonGeorgi/rain'}}})], 'LeonGeorgi/rain', ''), /Invalid/);
});

test('assembly keeps production and each preview isolated and removes obsolete previews', async t => {
  const f = await fixture(t);
  await f.put('artifacts/rain-preview-1/index.html', 'preview 1');
  await f.put('artifacts/rain-preview-1/data/stations.json', 'preview data');
  await f.put('artifacts/rain-preview-2/index.html', 'preview 2');
  await f.put('artifacts/rain-preview-99/index.html', 'closed preview');
  await f.put('site/pr-preview/88/index.html', 'stale deployment');
  const previews = previewPlan([pr(1), pr(2)], 'LeonGeorgi/rain', '');
  assert.deepEqual(await f.run(previews), previews);
  assert.equal(await readFile(join(f.root, 'site/index.html'), 'utf8'), 'main');
  assert.equal(await readFile(join(f.root, 'site/data/stations.json'), 'utf8'), 'production data');
  assert.equal(await readFile(join(f.root, 'site/pr-preview/1/data/stations.json'), 'utf8'), 'preview data');
  assert.equal(await readFile(join(f.root, 'site/pr-preview/2/index.html'), 'utf8'), 'preview 2');
  await assert.rejects(access(join(f.root, 'site/pr-preview/99')));
  await assert.rejects(access(join(f.root, 'site/pr-preview/88')));
  await f.run([]);
  await assert.rejects(access(join(f.root, 'site/pr-preview')));
  assert.equal(await readFile(join(f.root, 'site/index.html'), 'utf8'), 'main');
});

test('missing preview artifacts do not block production; missing production cannot be published', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.run(previewPlan([pr(1)], 'LeonGeorgi/rain', '')), []);
  await rm(join(f.root, 'production/index.html'));
  await assert.rejects(f.run([]), /Production build is missing/);
  assert.equal(await readFile(join(f.root, 'site/index.html'), 'utf8'), 'main');
});

test('symlinks cannot escape a preview or production artifact', async t => {
  const f = await fixture(t);
  await f.put('artifacts/rain-preview-1/index.html');
  await symlink(join(f.root, 'production'), join(f.root, 'artifacts/rain-preview-1/escape'));
  assert.deepEqual(await f.run(previewPlan([pr(1)], 'LeonGeorgi/rain', '')), []);
  await assert.rejects(access(join(f.root, 'site/pr-preview/1')));
  await symlink(join(f.root, 'site'), join(f.root, 'production/escape'));
  await assert.rejects(f.run([]), /Unsupported artifact/);
});

test('oversized previews are omitted before publication instead of blocking production', async t => {
  const f = await fixture(t);
  await f.put('artifacts/rain-preview-1/index.html', 'x'.repeat(100));
  assert.deepEqual(await f.run(previewPlan([pr(1)], 'LeonGeorgi/rain', ''), 50), []);
  await assert.rejects(f.run([], 1), /Production site exceeds/);
});

test('preview comments use the actual Pages URL and show the precise commit or a failure', () => {
  const preview = {number: 1, sha};
  assert.match(previewComment(preview, 'https://rain.example.com/', true), /https:\/\/rain.example.com\/pr-preview\/1\//);
  assert.match(previewComment(preview, 'https://leongeorgi.github.io/rain/', true), /https:\/\/leongeorgi.github.io\/rain\/pr-preview\/1\//);
  assert.match(previewComment(preview, 'https://rain.example.com/', true), new RegExp(sha));
  assert.match(previewComment(preview, 'https://rain.example.com/', false), /Preview unavailable/);
});

test('one bot comment is updated without changing user comments or posting duplicates', async () => {
  const comments = [{id: 1, user: {login: 'LeonGeorgi'}, body: '<!-- rain-pr-preview --> user text'}];
  const writes = [];
  const github = {paginate: async () => comments, rest: {issues: {
    listComments() {}, createComment: async args => writes.push(['create', args]), updateComment: async args => writes.push(['update', args]),
  }}};
  const repo = {owner: 'LeonGeorgi', repo: 'rain'};
  const body = '<!-- rain-pr-preview -->\nnew';
  await updatePreviewComment(github, repo, 1, body);
  assert.equal(writes[0][0], 'create');
  comments.push({id: 2, user: {login: 'github-actions[bot]'}, body: '<!-- rain-pr-preview --> old'});
  await updatePreviewComment(github, repo, 1, body);
  assert.equal(writes[1][0], 'update');
  assert.equal(writes[1][1].comment_id, 2);
  comments[1].body = body;
  await updatePreviewComment(github, repo, 1, body);
  assert.equal(writes.length, 2);
});
