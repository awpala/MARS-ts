# Coolify deployment runbook

MARS-ts is live and stable at `https://mars-ide.portfolio-projects.dev`, deployed from `awpala/MARS-ts` through the corresponding GitHub App in Coolify. This runbook covers maintenance of that existing deployment, routine releases, configuration changes, and recovery.

For an ordinary release, use steps 4–6 to validate the revision, follow its deployment, and run release smoke checks. Consult steps 1–3 when changing configuration or recreating the service, step 7 when maintaining deployment filters, and step 8 for rollback. The configuration and smoke checks are operating procedures for the live service.

This procedure applies to this repository's existing static build. MARS-ts has no production Dockerfile or repository-managed Nginx configuration. Use **Nixpacks with static output**, which builds with Node 24 and serves `build/` through Coolify's Nginx image. Configure asset caching in Coolify's generated Nginx configuration as described below. The [deployment decision](../adrs/0005-coolify-deployment.md) records that boundary. Java is needed for development and oracle checks, not production serving.

Use the existing Coolify project, environment, application, GitHub App, and server when maintaining this service. Keep their installation-specific identifiers and DNS values in the deployment records. The Custom Nginx configuration field is under **Settings → General → Build pipeline**; older control names are noted elsewhere where useful.

## 1. Coolify dashboard: locate or recreate the application

1. Open **Projects**, select the MARS project's environment, and open the application whose Git Source is `awpala/MARS-ts`. Use `mars-ts` when a new project or application name is needed.
2. When recreating the service, select **+ New → Private Repository (with GitHub App)** in that environment. Select the intended deployment server, then the existing GitHub App corresponding to MARS-ts. This source method also works when the repository is public.
3. Select `awpala/MARS-ts`, then **Load Repository**. Select branch `main`, Build Pack **Nixpacks**, Base Directory `/`, and static output with Publish Directory `/build` and internal port `80`. Select **Continue** and finish configuration before deploying.
4. If the repository is missing, open **Sources → the corresponding GitHub App → General → Repositories** (older layouts use **Update Repositories**). On GitHub, confirm that the App installation has access to `awpala/MARS-ts`, then refresh the repository list in Coolify. Keep a dedicated App restricted to this repository.

The [official GitHub App procedure](https://coolify.io/docs/applications/sources/github/app) describes source installation and application creation. An App source or project alone does not create a deployable Application. Its credentials belong to Coolify's source integration, not application variables or the browser bundle.

The service uses one Git-backed Application pointing to `awpala/MARS-ts` through its corresponding App and intended server. Keep its project, environment, application name/ID, and server public address in the deployment records when recreating or moving it.

## 2. Coolify dashboard: maintain build, domain, and runtime settings

### Git Source

Under **Application → Configuration → Git Source**, confirm repository `awpala/MARS-ts`, branch `main`, commit `HEAD`, and the corresponding GitHub App. Save any changes. `HEAD` follows the selected branch; a pinned revision is reserved for recovery.

### General: build and network

Open **Settings → General** and maintain the **Build pipeline** and **Networking** cards using the following configuration reference. Older layouts place General under Configuration.

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
| Custom Nginx configuration | Complete `server { ... }` configuration below; replaces `/etc/nginx/conf.d/default.conf` |
| Ports Exposes | `80` |
| Port Mappings | Empty |
| HTTP Basic Authentication / Authentication | Disabled / `None` |

Save and reload the page to confirm the settings persisted. Coolify's [Nixpacks deployment guide](https://coolify.io/docs/applications/builds/nixpacks/deploy) describes static output and the internal Nginx port. The standalone **Static** build pack serves files already in Git; this repository needs the Node build first. Local development/preview remains on `6277`, and automated browser testing remains on `6278`.

The [package manifest](../../package.json) requires Node 24. Keep development dependencies during installation because they include the compiler and static adapter. The install command prints the resolved Node version into the build log. Verify that it is Node 24; if needed, set `NIXPACKS_NODE_VERSION=24` as a build-time variable and rebuild. An installed Nixpacks version/archive that cannot supply Node 24 must be corrected before release; do not relax the project's engine requirement. See [Coolify's Node version selection](https://coolify.io/docs/applications/builds/nixpacks/node-versioning).

Leave `MARS_VALIDATION` unset in Coolify. [Vite configuration](../../vite.config.ts) deliberately sends validation builds to `__build/browser-site`; the normal production build writes `build/`. No application runtime secrets, database, persistent volumes, or bind mounts are required. Keep Coolify-managed metadata, but do not copy local environment files or GitHub App credentials into application variables.

### Static asset caching

The desktop Lighthouse report captured on October 20, 2026 identified hashed-asset caching as a maintenance improvement for the live site. Use **Settings → General → Build pipeline** (card/section) → **Custom Nginx configuration** (input field). This field replaces the complete `/etc/nginx/conf.d/default.conf` file; it does not append directives inside a generated `server` block. Coolify's [static-image build implementation](https://github.com/coollabsio/coolify/blob/main/app/Jobs/ApplicationDeploymentJob.php) copies the field into that file and publishes the site at `/usr/share/nginx/html`.

Replace the field's contents with this complete configuration. The outer `server { ... }` is required. Do not wrap it in `http { ... }` or paste only the inner cache directives: the image already includes `conf.d` inside its `http` context, where a bare `location` is invalid. If adapting an existing complete server configuration, keep its site-specific headers and other required settings while merging these locations and cache rules.

```nginx
server {
    listen 80;
    server_name _;

    # Both locations inherit Coolify's published asset directory.
    root /usr/share/nginx/html;
    index index.html;

    # Unversioned documents and assets revalidate after a release.
    expires off;
    add_header Cache-Control "no-cache";

    # Keep the 404 status while the SvelteKit fallback renders the themed error view.
    error_page 404 /404.html;

    location = /404.html {
        internal;
    }

    # Content hashes change whenever these files change.
    location ^~ /_app/immutable/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Serve real files and directory indexes; unknown paths return 404.
    location / {
        try_files $uri $uri/ =404;
    }
}
```

Keep `root` at server scope so the immutable-assets location inherits it too. The `error_page` directive serves the generated `404.html` for missing URLs while preserving HTTP 404; its client router renders the global themed fallback. Existing files such as `/llms.txt` and `/robots.txt` continue through `try_files` unchanged. Apply this configuration when releasing the fallback page; building the file alone does not configure the live host. The container listens on HTTP port `80`; Coolify's proxy continues to own public HTTPS. MIME types and other image-wide settings remain in the image's parent Nginx configuration. Validate the complete candidate with `nginx -t` using the configured static image before publishing a configuration change.

The service worker (`/service-worker.js`) and `/manifest.webmanifest` must also revalidate, which the server-level `no-cache` already provides; never give them the immutable policy, or releases will not reach installed copies ([ADR 0010](../adrs/0010-pwa-offline-support.md)). Confirm the image's MIME table serves `.webmanifest` as `application/manifest+json` (or at least a JSON type) and `.js` as JavaScript.

Only `/_app/immutable/` receives the year-long immutable policy. HTML, `/_app/version.json`, `/llms.txt`, `/robots.txt`, the license, favicon, and unversioned icons retain revalidation. Do not use `always` for the immutable header: missing chunks must return a real `404` without a long-lived cache policy. Nginx inherits `add_header` directives only when the current level defines none, so repeat any existing higher-level security headers in the new location and ensure other locations do not override the intended revalidation policy. See the [Nginx header module](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

Save and **redeploy/rebuild** after editing the Nginx configuration; restarting an existing image does not incorporate it. [Coolify's static-server guidance](https://coolify.io/docs/applications/builds/static#nginx-configuration) describes that image-build boundary. Include the header checks in step 6 when releasing cache-policy changes.

### Domain

Open **Configuration → Domains → Add domain**, choose HTTPS, enter `mars-ide.portfolio-projects.dev`, and select internal port `80` if requested. Enable HTTP-to-HTTPS redirection. In older layouts, set **General → Domains** to `https://mars-ide.portfolio-projects.dev`. Save and keep Coolify-managed proxy routing. The [domain settings documentation](https://coolify.io/docs/applications/configuration/general#domains) distinguishes the internal target port from the visitor-facing HTTPS origin.

### Healthcheck and image retention

In **Configuration → Healthcheck**, enable an HTTP check using `GET`, scheme `http`, host `localhost`, port `80`, and path `/`. Use interval `30` seconds, timeout `5` seconds, retries `3`, and start period `10` seconds. If expected status is shown, set `200`, but independently verify the public response in step 6. There is no `/healthz` endpoint in this application. A successful root request checks static serving; it does not test the simulator.

Coolify's [health-check documentation](https://coolify.io/docs/applications/configuration/health-checks) requires `curl` or `wget` inside the final container. After startup, use the application's **Terminal** to confirm the client exists and request `http://localhost:80/` with it. A health-check configuration change requires container recreation through restart or redeployment. Check health after releases and recovery operations.

Open **Rollback → Image retention**, retain at least two images, and verify server cleanup does not override retention. Step 8 needs a retained working image.

## 3. Coolify dashboard: configure deployment triggers

### Selective automatic deployment

**Watch Paths belongs to this Coolify Application, not GitHub.** Under **Settings → General → Build pipeline → Watch Paths**, maintain the following, one pattern per line:

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
!_legacy-app/**
```

Save, reload, and confirm the complete list remains. These paths select application code, dependencies, public assets, build configuration, tests, and verification tooling. The final `static/**` restores all published assets after the Markdown exclusion: even `static/README.md` is copied by the current static build. Repository documentation under `docs/`, library READMEs, and unrelated agent/editor settings do not select a deployment. Changes to the read-only Java reference are not part of the release workflow. Add paths here if new build inputs are introduced elsewhere.

Coolify uses ordered matching, with the last matching pattern winning. Manual deployments bypass the filter. The [automatic-deployment documentation](https://coolify.io/docs/applications/deployments/automatic-deployments) describes these rules; saving this runbook does not configure the dashboard.

### Enable main pushes and disable previews

Under **Configuration → Advanced → Deployment**, set **Auto deploy** to **Deploy on push (webhooks)**; older layouts have an **Auto Deploy** switch. Disable **Preview Deployments** on that page or the separate preview settings page. Save and confirm the production branch is still `main`.

The App integration supplies push events. No manually copied deploy webhook, Actions deployment secret, or new deployment workflow is needed. The existing [Verify workflow](../../.github/workflows/verify.yml) runs independently: Auto Deploy can publish before Verify finishes, and a failed Verify run does not automatically roll back a release. Keep releases sequential and check the deployed SHA against its CI result.

## 4. Devcontainer terminal and DNS provider: validate a release or infrastructure change

For the intended release revision, run inside the devcontainer:

```sh
cd /workspace
MARS_VALIDATION=1 run-checks
npm run test:browser
```

Require the harness, documentation, legacy oracle, and app tiers to pass. Install browser prerequisites with `npm run test:browser:install` if needed. Browser tests use `6278`; leave `6277` available for human review. These commands verify source and the isolated static build, not Coolify's generated image. Current CI runs the aggregate gates but does not run the Playwright suite or a production-container HTTP test.

Ordinary application releases retain the current domain and DNS. When moving servers or changing DNS, update the `mars-ide` record in the **DNS provider's dashboard for `portfolio-projects.dev`** using the server's public address from **Coolify → Servers** or the server provider. Publish an AAAA record only when that server's IPv6 routing and proxy are configured. Keep public ports `80` and `443` routed to the Coolify proxy for this hostname.

After DNS or ingress changes, inspect the records from the **devcontainer terminal** using `dig` if available, or an equivalent DNS lookup tool:

```sh
dig +short A mars-ide.portfolio-projects.dev
dig +short AAAA mars-ide.portfolio-projects.dev
dig +short CAA mars-ide.portfolio-projects.dev
dig +short CAA portfolio-projects.dev
```

Confirm A/AAAA answers match the intended ingress and that any effective CAA policy permits the configured certificate issuer. Check the public HTTPS origin after DNS, ingress, or certificate changes.

Export any important sources from an existing development or previous production origin before moving. Source files and preferences are browser-local and origin-scoped; they do not automatically appear at the new domain. See the [persistence contract](../../IMPLEMENTATION.md#configuration-and-persistence).

Use the existing release pipeline below after validating the intended revision or configuration change.

## 5. GitHub website and Coolify dashboard: publish a release

1. **GitHub:** confirm the intended release is on `main` in `awpala/MARS-ts`. If a prepared branch still needs merging, review its checks and merge through the normal human release workflow. The release must contain the application source, `static/`, manifest, lockfile, and Vite configuration.
2. **Coolify → Deployments / Deployment Logs:** open the deployment triggered by the matching push. Use **Deploy** for an intended manual release or a configuration change that requires rebuilding the image; repository documentation changes alone normally do not select a deployment. Avoid starting another deployment while one is running.
3. Follow the log through source checkout, Node 24 selection, dependency installation, `npm run build`, publication of `build/`, and container startup. Confirm the final serving process is Nginx on `80`, and that the application becomes healthy.
4. Record the checked-out SHA and Coolify deployment ID. In **GitHub → Actions → Verify**, require success for that exact revision. Do not substitute a passing run for a different SHA.
5. Complete step 6. A successful image build or green health indicator alone is insufficient release evidence.

## 6. Devcontainer terminal and browser: run release smoke checks

Use these checks after application or hosting changes, rollback, or incident recovery. Run the requests without disabling certificate validation:

```sh
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/
curl --connect-timeout 10 --max-time 30 -I http://mars-ide.portfolio-projects.dev/
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/MARSlicense.txt
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/llms.txt
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/robots.txt
curl --connect-timeout 10 --max-time 30 -I https://mars-ide.portfolio-projects.dev/_app/version.json
curl --connect-timeout 10 --max-time 30 -I https://mars-ide.portfolio-projects.dev/_app/immutable/missing-chunk.js
curl --connect-timeout 10 --max-time 30 -i https://mars-ide.portfolio-projects.dev/missing-page/
```

| Request | Required result |
| --- | --- |
| HTTPS `/` | HTTP `200`, MARS HTML with one canonical link to `https://mars-ide.portfolio-projects.dev/`, valid certificate for this hostname |
| HTTP `/` | Redirect to the HTTPS origin, without an internal port or hostname |
| `/MARSlicense.txt` | HTTP `200`, the bundled Pete Sanderson and Kenneth Vollmar license text |
| `/llms.txt` | HTTP `200`, plain-text MARS agent guidance matching the shipped asset; cache revalidation |
| `/robots.txt` | HTTP `200`, plain-text crawler policy allowing all paths and matching the shipped asset; cache revalidation |
| `/_app/version.json` | HTTP `200`, JSON with cache revalidation |
| `/_app/immutable/missing-chunk.js` | HTTP `404`, no year-long immutable cache policy, no HTML fallback |
| `/missing-page/` | HTTP `404`; no successful SPA fallback to the IDE |

The current application has only the root route. Do not copy the calculator's nested-route, sitemap, or `/healthz` checks. If the generated server returns the IDE for unknown paths, confirm **Static** rather than **SPA** mode and correct the generated Nginx configuration before accepting the release. Custom Nginx changes require a rebuild.

In a clean **browser profile**, open the HTTPS site:

1. Confirm the desktop becomes interactive, toolbar icons load, and developer tools show no failed `/_app/` JavaScript/CSS requests or uncaught startup errors. Refresh the root URL directly. In the page head, confirm one `rel="canonical"` link points to `https://mars-ide.portfolio-projects.dev/` and the `rel="describedby"` link resolves to `/llms.txt`.
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
5. In developer tools, inspect HTML and asset cache headers. Copy an actual hashed JavaScript or CSS URL from this release and verify its response has `Cache-Control: public, max-age=31536000, immutable`; repeat with `curl -I` against that URL. Confirm HTML, `/_app/version.json`, `/llms.txt`, and `/robots.txt` use `Cache-Control: no-cache`. With **Disable cache** unchecked, reload and confirm unchanged hashed assets are reused. Confirm a normal reload after a later release loads that release's assets; a forced refresh must not be the only way to see updated code.
6. With a fresh page load and the Network panel open, confirm the eleven Help article chunks are absent from the initial requests. Open **Help → Introduction** and **Help → Syscalls**; each should request its corresponding hashed article chunk when first opened, display its content and snippet controls, and close with Escape. Loading or a failed request must leave the dialog dismissible. The F1 overview and About MARS remain immediately available.
7. In developer tools → Application, confirm `/manifest.webmanifest` parses without errors, `/service-worker.js` is activated for the origin, and the cache named for this release holds the precached files. After a reload, switch the Network panel to Offline and confirm the desktop still loads. Two Manifest-panel warnings about missing `screenshots` (wide and non-wide) are expected and harmless; they only affect the richer install dialog and are deferred. An already-open tab keeps the previous release until every tab closes ([ADR 0010](../adrs/0010-pwa-offline-support.md)).

For desktop Lighthouse comparisons, use an extension-free browser profile and the same desktop settings, distinguishing a cold load from a warm-cache reload. Extension-injected scripts, styles, and layout work are outside the application measurement. Bundle-size comparisons alone do not establish an improved Lighthouse score; collect a new report after deploying the intended revision. Mobile layout and mobile audits are outside the current desktop performance scope.

Record the source SHA, Verify result, local gate/browser results, deployment ID, health, DNS/TLS results, and browser smoke results together. The simulator needs JavaScript; a static HTTP response alone does not establish that it works.

## 7. GitHub and Coolify: maintain selective deployment

After changing Watch Paths or deployment triggers, use ordinary intended changes to check the filter:

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
| Nginx reports `"location" directive is not allowed here` in `default.conf` | Replace Custom Nginx configuration with the complete `server { ... }` example in step 2, save, and rebuild/redeploy. The field replaces the entire file; cache fragments pasted at its top level are invalid. |
| Default page or proxy `502` | Confirm static output, publish directory, domain target port `80`, runtime logs, and health. Local port `6277` is not the production target. |
| Unhealthy container or proxy `404` | Test `/` inside the container with `curl` or `wget`; check health configuration, published `index.html`, and domain routing. |
| Certificate error or wrong site | Check A/AAAA, effective CAA policy, server ingress, exact hostname, duplicate domain assignments, and proxy certificate logs. |
| HTML loads but the IDE is blank | Inspect failed assets and browser errors; confirm the deployed output includes `/_app/` assets and there is no stale HTML/cache mismatch. |
| Saved sources appear missing | Confirm the exact HTTPS origin and browser profile. Browser data is not stored in Coolify; import an exported copy from the previous origin. |
| Failed Verify after publication | Inspect the deployed SHA and CI failure. Pause Auto Deploy and use step 8 if the published revision is unsuitable. |
