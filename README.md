# mcp-github-api

Search repositories, issues, code, users, and trending repos on GitHub.

## Tools

| Tool | Description |
|------|-------------|
| `search_repos` | Search GitHub repositories. |
| `get_repo` | Get repository details. |
| `list_issues` | List repository issues. |
| `get_user` | Get GitHub user profile. |
| `search_code` | Search code across GitHub (requires auth). |
| `get_trending` | Get trending repositories (scrapes GitHub trending page data via search). |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token (optional, increases rate limit) |

## Installation

```bash
git clone https://github.com/PetrefiedThunder/mcp-github-api.git
cd mcp-github-api
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-api": {
      "command": "node",
      "args": ["/path/to/mcp-github-api/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

## Usage with npx

```bash
npx mcp-github-api
```

## License

Apache-2.0
