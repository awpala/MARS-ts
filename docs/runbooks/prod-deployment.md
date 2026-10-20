# Coolify deployment runbook

Deploy `awpala/MARS-ts` at `https://mars-ide.portfolio-projects.dev` through the corresponding GitHub App in Coolify. Follow these steps in order; each names the system being used. Steps 1–4 prepare the application, and step 5 publishes it.

This procedure adapts the Financial Calculators runbook to this repository's existing static build. MARS-ts has no production Dockerfile or custom Nginx configuration. Use **Nixpacks with static output**, which builds with Node 24 and serves `build/` through Coolify's Nginx image. The [deployment decision](../adrs/0005-coolify-deployment.md) records that boundary. Java is needed for development and oracle checks, not production serving.

The domain and repository are known; the Coolify project, environment, application ID, GitHub App display name, server address, DNS records, and installed dashboard layout have not been inspected. Confirm those values in your installation. The UI instructions follow Coolify's official documentation, with older control names noted where useful. The reference project's IP address, internal port, health endpoint, and routes are not MARS-ts settings.

## 1. Coolify dashboard: select the application and GitHub App

1. Open **Projects**, select the MARS project's environment, and open the application whose Git Source is `awpala/MARS-ts`. Use `mars-ts` when a new project or application name is needed.
2. If no application exists, select **+ New → Private Repository (with GitHub App)** in that environment. Select the intended deployment server, then the existing GitHub App corresponding to MARS-ts. This source method also works when the repository is public.
3. Select `awpala/MARS-ts`, then **Load Repository**. Select branch `main`, Build Pack **Nixpacks**, Base Directory `/`, and static output with Publish Directory `/build` and internal port `80`. Select **Continue** and finish configuration before deploying.
4. If the repository is missing, open **Sources → the corresponding GitHub App → General → Repositories** (older layouts use **Update Repositories**). On GitHub, confirm that the App installation has access to `awpala/MARS-ts`, then refresh the repository list in Coolify. Keep a dedicated App restricted to this repository.

The [official GitHub App procedure](https://coolify.io/docs/applications/sources/github/app) describes source installation and application creation. An App source or project alone does not create a deployable Application. Its credentials belong to Coolify's source integration, not application variables or the browser bundle.

**Expected result:** one Git-backed Application points to `awpala/MARS-ts` through its corresponding App and intended server. Record its project, environment, application name/ID, and server public address for the release record.

## 2. Coolify dashboard: save build, domain, and runtime settings

### Git Source

Under **Application → Configuration → Git Source**, confirm repository `awpala/MARS-ts`, branch `main`, commit `HEAD`, and the corresponding GitHub App. Save any changes. `HEAD` follows the selected branch; a pinned revision is reserved for recovery.

### General: build and network

Open **Configuration → General** and configure the build and network sections. Newer layouts call these **Build pipeline** and **Networking**.

| Field | Value |
| --- | --- |
| Build Pack / Build strategy | `Nixpacks` |
| Base Directory | `/` |
| Site type / Output type | `Static` / `Static site`; in older layouts enable **Is it a static site?** |
| SPA option, if present | Disabled |
| Publish Directory | `/build` |
| Install Command | `node --version && npm ci --include=dev` |
| Build Command | `npm run build` |
| Start Command | Empty; the static server owns startup |
| Static server | Nginx |
| Custom Nginx configuration | Default generated configuration initially; verify it in step 6 |
| Ports Exposes | `80` |
| Port Mappings | Empty |
| HTTP Basic Authentication / Authentication | Disabled / `None` |

Save and reload the page to confirm the settings persisted. Coolify's [Nixpacks deployment guide](https://coolify.io/docs/applications/builds/nixpacks/deploy) describes static output and the internal Nginx port. The standalone **Static** build pack serves files already in Git; this repository needs the Node build first. Local development/preview remains on `6277`, and automated browser testing remains on `6278`.

The [package manifest](../../package.json) requires Node 24. Keep development dependencies during installation because they include the compiler and static adapter. The install command prints the resolved Node version into the build log. Verify that it is Node 24; if needed, set `NIXPACKS_NODE_VERSION=24` as a build-time variable and rebuild. An installed Nixpacks version/archive that cannot supply Node 24 must be corrected before release; do not relax the project's engine requirement. See [Coolify's Node version selection](https://coolify.io/docs/applications/builds/nixpacks/node-versioning).

Leave `MARS_VALIDATION` unset in Coolify. [Vite configuration](../../vite.config.ts) deliberately sends validation builds to `__build/browser-site`; the normal production build writes `build/`. No application runtime secrets, database, persistent volumes, or bind mounts are required. Keep Coolify-managed metadata, but do not copy local environment files or GitHub App credentials into application variables.

### Domain

Open **Configuration → Domains → Add domain**, choose HTTPS, enter `mars-ide.portfolio-projects.dev`, and select internal port `80` if requested. Enable HTTP-to-HTTPS redirection. In older layouts, set **General → Domains** to `https://mars-ide.portfolio-projects.dev`. Save and keep Coolify-managed proxy routing. The [domain settings documentation](https://coolify.io/docs/applications/configuration/general#domains) distinguishes the internal target port from the visitor-facing HTTPS origin.

### Healthcheck and image retention

In **Configuration → Healthcheck**, enable an HTTP check using `GET`, scheme `http`, host `localhost`, port `80`, and path `/`. Use interval `30` seconds, timeout `5` seconds, retries `3`, and start period `10` seconds. If expected status is shown, set `200`, but independently verify the public response in step 6. There is no `/healthz` endpoint in this application. A successful root request checks static serving; it does not test the simulator.

Coolify's [health-check documentation](https://coolify.io/docs/applications/configuration/health-checks) requires `curl` or `wget` inside the final container. After startup, use the application's **Terminal** to confirm the client exists and request `http://localhost:80/` with it. A health-check configuration change requires container recreation through restart or redeployment. Do not treat an unhealthy deployment as complete.

Open **Rollback → Image retention**, retain at least two images, and verify server cleanup does not override retention. Step 8 needs a retained working image.

## 3. Coolify dashboard: configure deployment triggers

### Selective automatic deployment

**Watch Paths belongs to this Coolify Application, not GitHub.** Under **Configuration → General → Build / Build pipeline → Watch Paths**, paste the following, one pattern per line:

```text
src/**
static/**
package.json
package-lock.json
.npmrc
vite.config.ts
tsconfig.json
eslint.config.js
prettier.config.js
playwright.config.ts
tests/**
.github/workflows/**
.devcontainer/scripts/bin/**
!**/*.md
static/**
```

Save, reload, and confirm the complete list remains. These paths select application code, dependencies, public assets, build configuration, tests, and verification tooling. The final `static/**` restores all published assets after the Markdown exclusion: even `static/README.md` is copied by the current static build. Repository documentation under `docs/`, library READMEs, and unrelated agent/editor settings do not select a deployment. Changes to the read-only Java reference are not part of the release workflow. Add paths here if new build inputs are introduced elsewhere.

Coolify uses ordered matching, with the last matching pattern winning. Manual deployments bypass the filter. The [automatic-deployment documentation](https://coolify.io/docs/applications/deployments/automatic-deployments) describes these rules; saving this runbook does not configure the dashboard.

### Enable main pushes and disable previews

Under **Configuration → Advanced → Deployment**, set **Auto deploy** to **Deploy on push (webhooks)**; older layouts have an **Auto Deploy** switch. Disable **Preview Deployments** on that page or the separate preview settings page. Save and confirm the production branch is still `main`.

The App integration supplies push events. No manually copied deploy webhook, Actions deployment secret, or new deployment workflow is needed. The existing [Verify workflow](../../.github/workflows/verify.yml) runs independently: Auto Deploy can publish before Verify finishes, and a failed Verify run does not automatically roll back a release. Keep releases sequential and check the deployed SHA against its CI result.

## 4. Devcontainer terminal and DNS provider: complete pre-flight checks

For the intended release revision, run inside the devcontainer:

```sh
cd /workspace
MARS_VALIDATION=1 run-checks
npm run test:browser
```

Require the harness, documentation, legacy oracle, and app tiers to pass. Install browser prerequisites with `npm run test:browser:install` if needed. Browser tests use `6278`; leave `6277` available for human review. These commands verify source and the isolated static build, not Coolify's generated image. Current CI runs the aggregate gates but does not run the Playwright suite or a production-container HTTP test.

In the **DNS provider's dashboard for `portfolio-projects.dev`**, configure the `mars-ide` record for the selected Coolify deployment server's public address. Confirm that address from **Coolify → Servers** or the server provider; do not assume the reference application's address. Publish an AAAA record only when that server's IPv6 routing and proxy are configured. Ensure public ports `80` and `443` reach the Coolify proxy for this hostname.

In the **devcontainer terminal**, inspect DNS using `dig` if available, or an equivalent DNS lookup tool:

```sh
dig +short A mars-ide.portfolio-projects.dev
dig +short AAAA mars-ide.portfolio-projects.dev
dig +short CAA mars-ide.portfolio-projects.dev
dig +short CAA portfolio-projects.dev
```

Confirm A/AAAA answers match the intended ingress and that any effective CAA policy permits the configured certificate issuer. A missing route or default certificate before deployment is not a passing site check. Require valid HTTPS after deployment.

Export any important sources from an existing development or previous production origin before moving. Source files and preferences are browser-local and origin-scoped; they do not automatically appear at the new domain. See the [persistence contract](../../IMPLEMENTATION.md#configuration-and-persistence).

**Preparation is complete. The next step publishes the application.**

## 5. GitHub website and Coolify dashboard: deploy

1. **GitHub:** confirm the intended release is on `main` in `awpala/MARS-ts`. If a prepared branch still needs merging, review its checks and merge through the normal human release workflow. The release must contain the application source, `static/`, manifest, lockfile, and Vite configuration.
2. **Coolify → Deployments / Deployment Logs:** open the deployment triggered by the matching push. If the revision was already on `main` before configuration, select **Deploy** once. A documentation-only change may also require this initial manual deployment. Avoid starting another deployment while one is running.
3. Follow the log through source checkout, Node 24 selection, dependency installation, `npm run build`, publication of `build/`, and container startup. Confirm the final serving process is Nginx on `80`, and that the application becomes healthy.
4. Record the checked-out SHA and Coolify deployment ID. In **GitHub → Actions → Verify**, require success for that exact revision. Do not substitute a passing run for a different SHA.
5. Complete step 6. A successful image build or green health indicator alone is insufficient release evidence.

## 6. Devcontainer terminal and browser: verify the public site

Run these requests without disabling certificate validation:

```sh
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/
curl --connect-timeout 10 --max-time 30 -I http://mars-ide.portfolio-projects.dev/
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/MARSlicense.txt
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/missing-page/
```

| Request | Required result |
| --- | --- |
| HTTPS `/` | HTTP `200`, MARS HTML, valid certificate for this hostname |
| HTTP `/` | Redirect to the HTTPS origin, without an internal port or hostname |
| `/MARSlicense.txt` | HTTP `200`, the bundled Pete Sanderson and Kenneth Vollmar license text |
| `/missing-page/` | HTTP `404`; no successful SPA fallback to the IDE |

The current application has only the root route. Do not copy the calculator's nested-route, sitemap, or `/healthz` checks. If the generated server returns the IDE for unknown paths, confirm **Static** rather than **SPA** mode and correct the generated Nginx configuration before accepting the release. Custom Nginx changes require a rebuild.

In a clean **browser profile**, open the HTTPS site:

1. Confirm the desktop becomes interactive, toolbar icons load, and developer tools show no failed `/_app/` JavaScript/CSS requests or uncaught startup errors. Refresh the root URL directly.
2. Create a new file, paste the following program, and save it as `deployment-smoke.asm` in the browser library:

   ```asm
   .text
   .globl main
   main:
       li $a0, 42
       li $v0, 1
       syscall
       li $v0, 10
       syscall
   ```

3. Select **Assemble**, then run the program. Confirm the Run I/O output includes `42` and execution finishes. Reset, single-step, and confirm the execution display advances. This is a deployment smoke check, not additional oracle parity evidence.
4. Reload and confirm the saved source remains available. Use **Export** to download it, then open **About MARS** and confirm its license link resolves. Test downloads in the actual browser used for the IDE.
5. In developer tools, inspect HTML and asset cache headers. HTML must not have a long-lived immutable cache policy. Confirm a normal reload after a later release loads that release's assets; a forced refresh must not be the only way to see updated code. Any custom cache policy needs verification on the deployed image.

Record the source SHA, Verify result, local gate/browser results, deployment ID, health, DNS/TLS results, and browser smoke results together. The simulator needs JavaScript; a static HTTP response alone does not establish that it works.

## 7. GitHub and Coolify: verify selective deployment

Use the next ordinary intended changes to test the filter:

1. Before a `docs/`-only merge, note the current deployment ID/SHA. After the merge, confirm Verify runs but Coolify creates no deployment for that commit.
2. After the next intended `src/`, `static/`, dependency, or selected verification change on `main`, confirm a webhook deployment is queued for its SHA and repeat steps 5–6.
3. Confirm unrelated branches do not update production with previews disabled. Manual **Deploy** cannot test Watch Paths because it bypasses them.

A `main` SHA ahead of the deployed SHA is expected when intervening changes only touch excluded documentation. A missing deployment for application code requires investigating the saved filter and webhook delivery.

## 8. Coolify dashboard: recover or roll back

1. Set **Advanced → Deployment → Auto deploy** to **Manual deployments only**, or disable the older Auto Deploy switch. Resolve queued/running releases before recovery so a later job does not overwrite it.
2. Open **Rollback**, identify the previous working SHA under **Available images**, and select **Roll back to this image**. Follow the operation in Deployment Logs. Confirm the current domain, health, and runtime settings still fit the older image.
3. Repeat step 6 and record the restored SHA. If the image was pruned, temporarily pin a known-good SHA under **Git Source** and deploy it; this rebuild depends on available source and build dependencies and is not equivalent to restoring a retained image.
4. Prepare and validate the forward fix through the normal release workflow. Restore commit `HEAD` and re-enable Auto Deploy only when `main` is ready to publish.

Coolify's [rollback documentation](https://coolify.io/docs/applications/deployments/rollbacks) explains image retention and reuse of current runtime configuration. An image rollback does not restore browser LocalStorage. Export valuable sources before recovery experiments; clearing browser storage is not a deployment repair.

## Diagnose a failed step

| Symptom | Where to investigate |
| --- | --- |
| Repository absent or checkout fails | **Sources → corresponding GitHub App:** verify installation access to `awpala/MARS-ts`; **Git Source:** verify App, repository, branch, and commit. |
| No deployment after a matching push | **Advanced:** Auto Deploy; **Git Source:** `main` and `HEAD`; **General:** Watch Paths; **GitHub App:** recent webhook deliveries and endpoint reachability. |
| Wrong Node version or unavailable Node package | Inspect the Nixpacks plan and install log; check the manifest and build-time version override. Resolve builder/archive support for Node 24. |
| Missing SvelteKit, Vite, or Tailwind during build | Confirm `npm ci --include=dev`, the root Base Directory, and the committed lockfile. Do not replace `npm ci` with `npm install`. |
| Missing `build/` | Confirm `npm run build`, Publish Directory `/build`, and absence of `MARS_VALIDATION=1`. Read the first build error. |
| Default page or proxy `502` | Confirm static output, publish directory, domain target port `80`, runtime logs, and health. Local port `6277` is not the production target. |
| Unhealthy container or proxy `404` | Test `/` inside the container with `curl` or `wget`; check health configuration, published `index.html`, and domain routing. |
| Certificate error or wrong site | Check A/AAAA, effective CAA policy, server ingress, exact hostname, duplicate domain assignments, and proxy certificate logs. |
| HTML loads but the IDE is blank | Inspect failed assets and browser errors; confirm the deployed output includes `/_app/` assets and there is no stale HTML/cache mismatch. |
| Saved sources appear missing | Confirm the exact HTTPS origin and browser profile. Browser data is not stored in Coolify; import an exported copy from the previous origin. |
| Failed Verify after publication | Inspect the deployed SHA and CI failure. Pause Auto Deploy and use step 8 if the published revision is unsuitable. |
