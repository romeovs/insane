# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

```bash
# Development mode with hot reloading
make tool.dev

# Production build
make tool.build

# Start GraphQL development server with GraphiQL
make tool.serve

# Run tests
make test

# Build the tools themselves
make build
```

## Project Architecture

**Insane** is a schema-first CMS framework that leans heavily on
type-safe GraphQL operations from TypeScript configuration files.

Users define a schema for their CMS in a config file (like `insane.config.ts`),
using `defineType()` and `defineField()`. `insane` in turn generate an expressive
GraphQL schema from this configuration, backed by a PostgreSQL database.

Users can query this schema using queries in their codebase, for which `insane`
will generate strong types.

Non-technical end-users can edit the data in the CMS using a simple and
straightforward user interface. Aspects of the UI are also configured in the
`insane.config.ts` using `defineType()` and `defineField()`, allowing for
heavy customization.

The whole system is designed to be run in ephemeral functional environments like
Next.js, and there is no need for persistent servers (other than the database).


### Project Structure
The meat of the project lives in the `insane/` directory, which contains the
different components of the project.

#### Core Components

**Schema Definition System** (`lib/schema/`): Declarative schema definition
using `defineType()` and `defineField()` with support for relationships,
validation, and multi-language features.

**Build Pipeline** (`build/`): Multi-stage process for input discovery, schema
generation, query optimization, and TypeScript code generation. This will be used
by devs to generate code and types for their queries that query the database for types
they defined.

**CLI Tool** (`tool/`): CLI commands for development workflow with
file watching and structured logging.

**Runtime Engine** (`runtime/`): Query execution engine with PostgreSQL
adapter and validation (in development).

**Development Tooling** (`dev/`): Internal developement helpers that make developing
`insane` easier.

### Key Files

- `insane.config.ts` - Main configuration file defining schema types and build
  settings
- `lib/schema/` - Core schema definition utilities and type system
- `tool/index.ts` - CLI entry point with dev, build, and serve commands
- `build/` - Code generation pipeline and optimization
- `runtime/engine/` - GraphQL execution runtime

### Development Patterns

**Schema Definition**: Types are defined using declarative configuration with
automatic GraphQL name generation and relationship management.

**Query Development**: GraphQL queries are embedded in TypeScript files and
discovered during build for type generation.

**Code Generation**: The build process generates TypeScript types and runtime
code from schema definitions and discovered queries.

**Hot Reloading**: Development mode provides reactive rebuilds when
configuration or source files change.

### TypeScript Configuration

- Strict TypeScript configuration with `exactOptionalPropertyTypes`
- Path aliases: `~/*` maps to internal modules
- Custom plugin for GraphQL validation and type generation

### Database Integration

- PostgreSQL adapter using `@dataplan/pg` and Grafast execution
- Schema-to-database mapping with type-safe query generation
- Support for relationships, constraints, and optimized queries

### Tests

- Unit tests are written as `{module}.spec.ts` files
- Run `make test` to execute tests
