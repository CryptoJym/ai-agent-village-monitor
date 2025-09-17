GitHubClient usage

Example wiring (already applied):
- Use `githubMiddleware()` to attach a shared `GitHubClient` to each request
- Read tokens from `GITHUB_TOKENS` (comma-separated) or `GITHUB_TOKEN`

Helpers implemented:
- `listOrgRepos(org)`
- `getRepoLanguages(owner, repo)` (with ETag caching)
- `triggerDispatch(owner, repo, workflowId, ref, inputs?)`
- `createPR({ owner, repo, title, head, base, body?, draft? })`
- `listIssues({ owner, repo, state })`

Observability:
- `client.lastRate` tracks latest rate limit headers

Route example:
```ts
app.get('/api/github/orgs/:org/repos', async (req, res) => {
  const data = await req.github!.listOrgRepos(req.params.org);
  res.json(data);
});
```

