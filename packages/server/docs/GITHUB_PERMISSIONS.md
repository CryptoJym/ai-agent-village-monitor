Minimal GitHub scopes and permissions

Recommended for a classic PAT (personal access token):
- public_repo (public repos only)
- repo (private repo access; implies contents:read/write)
- workflow (trigger workflow_dispatch)

GitHub App installation permissions (preferred for org usage):
- Repository permissions:
  - Contents: Read and write
  - Pull requests: Read and write
  - Workflows: Read and write (if workflow_dispatch is required)
  - Issues: Read (optional if listing issues)
- Organization permissions:
  - Members: Read (optional if listing org repos is restricted)

Notes:
- Use least privilege: drop write on PRs if only reading.
- Contents write is required for creating commits/branches via API.
- workflow permission is required to call workflow dispatch.

