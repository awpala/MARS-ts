# ADR 0005: Static deployment on Coolify

- **Status**: Accepted
- **Date**: 2026-10-19

## Context

Production is live and stable at `https://mars-ts.dev`, connected to `awpala/MARS-ts` through its corresponding GitHub App in Coolify. The application prerenders its root route; the repository now requires Node 26 to build its static assets. Railpack resolves it from the manifest's `engines.node`. Simulator execution and source persistence belong to the browser. The repository has no production Dockerfile or application server.

## Decision

Use Coolify's Railpack build strategy with static output: install the locked dependencies including development tools, run `npm run build`, and publish `build/` through Coolify's Nginx image on internal port `80`. Coolify owns public HTTPS and proxy routing. The local development/preview port remains `6277`. No Java runtime, database, application secrets, or persistent server storage is required. Production builds leave `MARS_VALIDATION` unset so validation output does not replace the normal publish directory.

Use the corresponding GitHub App for source access and automatic deployment of matching pushes to `main`. Keep preview deployments disabled. The [runbook](../runbooks/prod-deployment.md) owns dashboard settings, Watch Paths, release checks, and recovery. GitHub Actions Verify runs independently of deployment; it does not gate or roll back Coolify releases. The operator checks the deployed SHA, its Verify result, health, HTTPS, and the browser workflow after each release.

## Consequences and alternatives

This approach uses the existing build without adding production container files or builder configuration. The generated image depends on the Railpack version bundled with Coolify, which labels Railpack as Beta, so builder or hosting changes repeat checks of Node 26 selection, publication of the correct directory, static routing, and browser asset delivery. A repository-owned Dockerfile would give tighter image control but adds configuration and validation beyond this runbook. See the [official Railpack guidance](https://coolify.io/docs/applications/builds/railpack).

Browser data remains scoped to the public origin. Changing domain or scheme does not migrate saved sources, and rolling back a server image does not roll back browser storage. Export/import is the existing migration path. Deployment does not add cloud synchronization or complete unfinished port milestones.

## Evidence

The repository owner confirmed stable production hosting at the public origin on October 20, 2026. The checked-in manifest, Vite/static-adapter configuration, root prerender setting, existing CI workflow, and official Coolify documentation describe its build and delivery contract. The runbook supports ongoing maintenance and release-specific checks for that live deployment.
