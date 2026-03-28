# Project Overview

Supaslidev is a monorepo toolkit for managing multiple [Slidev](https://sli.dev/) presentations. It consists of two CLI packages and uses pnpm workspaces with catalog dependency management.

## Official Documentation

Before making changes to presentation content or Slidev configuration:

- **Slidev Website**: https://sli.dev/
- **LLM-optimized docs**: https://sli.dev/llms.txt

Fetch the llms.txt file for up-to-date Slidev syntax and features.

## Repository Structure

```
supaSliDev/
├── packages/
│   ├── cli/                 # create-supaslidev (workspace scaffolding)
│   └── supaslidev/          # @supaslidev/dashboard (presentation management)
├── playground/              # Example workspace for local development
├── .github/                 # CI/CD workflows
└── [config files]
```

## Packages

### packages/cli (create-supaslidev)

- Scaffolds new Supaslidev workspaces
- Handles migrations and workspace updates
- Entry: `src/cli.ts`
- Commands: create, status, migrate, update

### packages/supaslidev (@supaslidev/dashboard)

- Interactive dashboard UI for presentation management
- CLI for creating, running, exporting presentations
- Entry: `src/cli/index.ts` (CLI), `src/App.vue` (UI)
- Commands: dev, new, present, export

## Commands

| Command               | Description                       |
| --------------------- | --------------------------------- |
| `pnpm dev`            | Start interactive dashboard       |
| `pnpm new <name>`     | Create new presentation           |
| `pnpm present <name>` | Start dev server for presentation |
| `pnpm export <name>`  | Export to PDF                     |
| `pnpm dev:all`        | Dev servers for all presentations |
| `pnpm build:all`      | Build all presentations           |
| `pnpm lint`           | Run linting                       |
| `pnpm typecheck`      | TypeScript type checking          |
| `pnpm test`           | Run tests                         |

## Key Architecture Decisions

- **pnpm Catalog**: Versions centralized in `pnpm-workspace.yaml`. Use `catalog:` in presentation package.json files.
- **Workspace State**: Tracked in `.supaslidev/state.json` within user workspaces
- **Migration System**: `packages/cli/src/migrations/` handles workspace updates

## Development Workflow

1. **Testing locally**: Use `playground/` as a test workspace
2. **New presentations**: Always use `pnpm new` to ensure correct catalog dependencies
3. **CLI changes**: Build with `pnpm --filter create-supaslidev build` or `pnpm --filter @supaslidev/dashboard build`

## Testing

- E2E tests in `packages/*/tests/e2e/`
- Run with `pnpm test:e2e`
- Unit tests in `packages/*/tests/unit/`
- Run with `pnpm test`
