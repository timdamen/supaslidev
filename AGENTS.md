# Supaslidev - AI Agent Context

Monorepo toolkit for managing multiple [Slidev](https://sli.dev/) presentations with pnpm workspaces.

## Quick Reference

**Slidev Docs**: https://sli.dev/llms.txt (fetch for syntax/features)

## Structure

- `packages/cli/` - `create-supaslidev`: scaffolds new workspaces
- `packages/supaslidev/` - `@supaslidev/dashboard`: manages presentations (UI + CLI)
- `playground/` - test workspace for local development

## Key Commands

```bash
pnpm dev                   # Interactive dashboard
pnpm new <name>            # New presentation
pnpm present <name>        # Dev server for presentation
pnpm export <name>         # Export PDF
pnpm test                  # Run tests
pnpm lint                  # Linting
pnpm typecheck             # Type checking
```

## Architecture

- **pnpm Catalog**: Dependency versions in `pnpm-workspace.yaml`, referenced as `catalog:` in package.json
- **Workspace State**: `.supaslidev/state.json` tracks workspace version and migrations
- **Dashboard Server**: `packages/supaslidev/server/api.js` manages Slidev dev server processes

## Entry Points

| Package   | CLI Entry          | UI Entry      |
| --------- | ------------------ | ------------- |
| cli       | `src/cli.ts`       | -             |
| dashboard | `src/cli/index.ts` | `src/App.vue` |

## Testing

- E2E tests in `packages/*/tests/e2e/`
- Run with `pnpm test:e2e`
- Unit tests in `packages/*/tests/unit/`
- Run with `pnpm test`
