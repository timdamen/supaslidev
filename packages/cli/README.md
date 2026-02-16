# create-supaslidev

Scaffold and manage [Supaslidev](../../README.md) workspaces from the command line.

Supaslidev is a monorepo toolkit for managing multiple [Slidev](https://sli.dev/) presentations. This CLI handles the initial workspace setup and keeps it up to date as Supaslidev evolves.

## Installation

The recommended way to use this CLI is via `pnpm create`, which downloads and runs the latest version:

```bash
pnpm create supaslidev
```

You can also install it globally if you prefer:

```bash
pnpm add -g create-supaslidev
```

## Commands

### create

Scaffolds a new Supaslidev workspace with everything you need to start managing presentations.

```bash
# Interactive mode (recommended)
pnpm create supaslidev

# Or with options
pnpm create supaslidev --name my-slides --presentation intro-deck
```

**Options:**

| Option                       | Description               | Default               |
| ---------------------------- | ------------------------- | --------------------- |
| `-n, --name <name>`          | Workspace directory name  | Prompts interactively |
| `-p, --presentation <name>`  | First presentation name   | `my-first-deck`       |
| `-t, --template <template>`  | Template to use           | `default`             |
| `--git` / `--no-git`         | Initialize git repository | `true`                |
| `--install` / `--no-install` | Run pnpm install          | `true`                |

The wizard creates a pnpm workspace with:

- A `presentations/` directory for your decks
- A `packages/shared/` directory with reusable components, layouts, and styles (configured as a Slidev addon)
- Shared dependency management via pnpm catalog
- Scripts for common tasks

### status

Shows the current state of your workspace, including the CLI version, pending migrations, and any available updates.

```bash
create-supaslidev status
```

Run this from inside a Supaslidev workspace to see what version you're on and whether any migrations are waiting to be applied.

### migrate

Updates your workspace structure when a new version of Supaslidev introduces changes.

```bash
# Preview what would change (dry-run)
create-supaslidev migrate

# Apply the migrations
create-supaslidev migrate --apply
```

Always preview first. Migrations modify files in your workspace, so it's good practice to review what will change before applying.

### update

Checks whether a newer version of the CLI is available.

```bash
create-supaslidev update
```

If an update exists, you'll see the current and latest versions along with instructions to upgrade.

## Documentation

For detailed guides on workspace structure, the dashboard UI, and presentation management, see the [full documentation](../../docs/).

## License

[MIT](../../LICENSE)
