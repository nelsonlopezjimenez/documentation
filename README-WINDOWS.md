# Running the docs site on Windows and serving it offline

## Why `npm run develop` / `npm run build` fail on Windows

The `gatsby` script in `package.json` sets an environment variable with Unix shell syntax:

```json
"gatsby": "PARCEL_WORKERS=0 gatsby",
```

npm runs package scripts through `cmd.exe` on Windows, which does not understand that syntax:

```
'PARCEL_WORKERS' is not recognized as an internal or external command,
operable program or batch file.
```

Every script that goes through it fails the same way: `develop`, `develop:ssr`, `build`, `clean` and `serve`. (`PARCEL_WORKERS=0` works around [parcel-bundler/parcel#7702](https://github.com/parcel-bundler/parcel/issues/7702).)

The workaround is to set the variable in your shell and call Gatsby directly with `npx`. `npx` uses the copy installed in `node_modules/.bin`, so once dependencies are installed it works offline.

## Installing dependencies

Use `npm ci`, not `npm install`:

```powershell
npm ci
```

`npm ci` installs exactly what `package-lock.json` lists and never rewrites it. If the lockfile and `package.json` don't match, it fails instead of quietly changing the lockfile. `npm install` can rewrite the lockfile in several cases:

- **You're on an older commit.** npm may re-resolve parts of the dependency tree that a newer commit already updated. Run `git pull` first.
- **A different npm version.** Each npm version writes the lockfile slightly differently. Use the same npm major version on every machine.
- **A local or mirror registry** (for example [Verdaccio](https://verdaccio.org) at `http://localhost:4873`). Entries npm resolves fresh get `"resolved"` URLs that point at that registry.

**Never commit a lockfile that contains `localhost` or other private registry URLs.** Those URLs only work on that machine and break installs everywhere else. To check:

```powershell
git diff --ignore-cr-at-eol package-lock.json | Select-String "localhost|resolved"
```

To discard an accidental lockfile change and reinstall cleanly:

```powershell
git checkout package-lock.json
git pull
npm ci
```

`npm ci` still works with a local registry. By default npm downloads the lockfile's `registry.npmjs.org` URLs through the configured registry without rewriting the file (the `replace-registry-host` setting). This works as long as the registry has those versions cached or can proxy to npmjs.

If `git diff` shows the whole lockfile changed but `git diff --ignore-cr-at-eol` shows nothing, only the line endings differ (CRLF vs LF). In that case `git checkout package-lock.json` is enough.

## Commands per shell

Run these from the repository root, after [installing dependencies](#installing-dependencies).

| Task | npm script (fails on Windows) | PowerShell |
| --- | --- | --- |
| Dev server (http://localhost:8000) | `npm run develop` | `$env:PARCEL_WORKERS=0; npx gatsby develop` |
| Dev server with SSR | `npm run develop:ssr` | `$env:PARCEL_WORKERS=0; $env:GATSBY_DEV_SSR="true"; npx gatsby develop` |
| Production build into `public/` | `npm run build` | `$env:PARCEL_WORKERS=0; npx gatsby build --verbose --log-pages` |
| Clear `.cache` and `public/` | `npm run clean` | `$env:PARCEL_WORKERS=0; npx gatsby clean` |
| Serve the build (http://localhost:9000) | `npm run serve` | `$env:PARCEL_WORKERS=0; npx gatsby serve` |

The same commands in other shells:

**Command Prompt (cmd)**: write `&&` with no space before it, otherwise the value gets a trailing space.

```cmd
set PARCEL_WORKERS=0&& npx gatsby develop
set PARCEL_WORKERS=0&& npx gatsby build --verbose --log-pages
set PARCEL_WORKERS=0&& npx gatsby serve
```

**Git Bash**:

```bash
PARCEL_WORKERS=0 npx gatsby develop
PARCEL_WORKERS=0 npx gatsby build --verbose --log-pages
PARCEL_WORKERS=0 npx gatsby serve
```

In PowerShell and cmd the variable stays set for the rest of that terminal session, so later commands can be just `npx gatsby ...`.

Scripts that don't set environment variables work as-is: `npm test`, `npm run lint`, `npm run format`.

You can also skip `npx` and call the local binary directly:

```powershell
$env:PARCEL_WORKERS=0; .\node_modules\.bin\gatsby develop
```

### Optional: make the npm scripts work

Either of these makes `npm run develop` and the other scripts work unchanged:

- **Your machine only**: tell npm to run scripts with Git Bash:

  ```powershell
  npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"
  ```

  Undo with `npm config delete script-shell`.

- **The repo**: add `cross-env` as a dev dependency and change the script to `"gatsby": "cross-env PARCEL_WORKERS=0 gatsby"`.

## Useful build options

| Variable | Effect |
| --- | --- |
| `GITHUB_TOKEN` | Without it, the build can't call the GitHub API, and every page footer shows a placeholder contributor (`mona`). Set it to show real contributors: `$env:GITHUB_TOKEN="<token>"`. That call needs internet at build time. |
| `GATSBY_CONTENT_ALLOW` / `GATSBY_CONTENT_IGNORE` | Dev server only. Comma-separated folders under `content/` to include or skip, which makes startup faster. Example: `$env:GATSBY_CONTENT_ALLOW="cli"; npx gatsby develop` |
| `GATSBY_CONTENT_DIR` | Use a content folder other than `content/`. |

## Serving the build offline

After a build, `public/` holds a complete static site. To serve it:

- **Serve it at the site root** (`http://host:port/`), not under a subpath. The site uses absolute paths and has no `pathPrefix`.
- **Use an HTTP server.** Opening `public/index.html` from disk (`file://`) breaks navigation and search.
- **Map clean URLs to folders.** Each page is stored as `folder/index.html`, and links have no trailing slash (`trailingSlash: 'never'`). So `/about-npm` must serve `public/about-npm/index.html`.

### Option 1: Gatsby (from the repo)

```powershell
$env:PARCEL_WORKERS=0; npx gatsby serve --host 0.0.0.0 --port 9000
```

### Option 2: Node, no dependencies (`scripts/serve-offline.js`)

This option uses only Node's built-in modules, so it runs without `node_modules`. It serves clean URLs without redirects and returns the site's `404.html` with a real 404 status.

```powershell
node scripts/serve-offline.js            # http://localhost:8000, serves ./public
node scripts/serve-offline.js 8080       # different port
node scripts/serve-offline.js 8080 D:\site\public   # different folder
```

### Option 3: Python (nothing to install)

```powershell
python -m http.server 8000 --directory public
```

This works, but every page first redirects `/about-npm` to `/about-npm/`, which is harmless. Missing pages show Python's default error page instead of the site's `404.html`.

### Moving it to another machine

Copy `public/`. With Option 2, also copy `scripts/serve-offline.js` and pass the folder as the second argument. Only Node is required, no `npm ci` or `npm install`.

## What still needs the internet

All JS, CSS, search, fonts and content images are bundled locally. These are the only embedded resources loaded from another site:

| Resource | Source | Offline result |
| --- | --- | --- |
| Contributor avatars (`https://github.com/<login>.png`) | `src/components/page-footer.js` | Broken image in the page footer |
| YouTube embeds (7 videos under `content/packages-and-modules/`) | `YouTube` in `src/mdx/components.js` | Blank frame |
| `og:image` social preview | `imageUrl` in `gatsby-config.mjs` | Nothing visible. Only social-share previews use it |

Regular links to other sites (GitHub "Edit this page", npmjs.com, status.npmjs.com, the npm registry, MDN, etc.) stay in the pages. They only fail when clicked.
