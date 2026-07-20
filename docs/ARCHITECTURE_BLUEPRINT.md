# SemarEnv Architecture Blueprint

> Goal: Replace Electron with a lighter UI framework while preserving all essential env-manager functionality.

---

## Table of Contents

1. [Process Model](#1-process-model)
2. [Core Data Flow: Version Management](#2-core-data-flow-version-management)
3. [Version Switching (On-the-Fly, No System PATH)](#3-version-switching-on-the-fly-no-system-path)
4. [Project/Site System](#4-projectsite-system)
5. [IPC & Communication Protocol](#5-ipc--communication-protocol)
6. [Go Helper: Native Privileged Layer](#6-go-helper-native-privileged-layer)
7. [Renderer UI: What Electron Does](#7-renderer-ui-what-electron-does)
8. [Configuration & Persistence](#8-configuration--persistence)
9. [What Must Be Preserved vs What Can Be Replaced](#9-what-must-be-preserved-vs-what-can-be-replaced)
10. [Migration Strategy](#10-migration-strategy)
11. [File Reference Index](#11-file-reference-index)

---

## 1. Process Model

```
┌─────────────────────────────────────────────────────┐
│                  Go Helper Daemon                    │
│  (privileged system ops: hosts, env vars, certs)     │
│  Unix socket / Windows named pipe                    │
└────────────────────────┬────────────────────────────┘
                         │ HMAC-signed JSON
┌────────────────────────▼────────────────────────────┐
│              Electron Main Process                   │
│                                                      │
│  Launcher → Application (orchestrator)               │
│    ├─ ConfigManager (electron-store → user.json)     │
│    ├─ ServerManager (builds global.Server)           │
│    ├─ WindowManager (BrowserWindow factory)          │
│    ├─ TrayManager (system tray, classic/modern)      │
│    ├─ IPCHandler (command routing)                   │
│    ├─ ForkManager (utilityProcess pool)              │
│    └─ Helper.ts (Go helper client + HMAC signing)    │
└─────────────┬──────────────────────────┬────────────┘
              │ IPC (webContents)        │ postMessage
┌─────────────▼──────────┐  ┌────────────▼───────────┐
│   Renderer (Vue 3)     │  │  Fork Pool (N workers)  │
│   Pinia + Vue Router   │  │  fork.mjs entry point   │
│   Hash-based routing   │  │                         │
│   window.Server (rx)   │  │  BaseManager dispatch   │
│   54 modules via glob   │  │  50+ module singletons  │
└────────────────────────┘  │  Each extends Base       │
                             │  (fetch, install, run)   │
                             └─────────────────────────┘
```

### Startup Sequence

1. **Launcher** enforces single-instance lock → `app.ready` → `new Application()`
2. **Application constructor:**
   - `global.Server` = Vue `reactive()` proxy
   - `ConfigManager` opens `user.json` (electron-store)
   - `ServerManager` computes all directory paths, creates dirs on disk
   - `WindowManager` creates BrowserWindow → loads `render/index.html`
   - `TrayManager` creates system tray
   - `IPCHandler` registers `ipcMain` listeners
   - `ForkManager` creates utilityProcess pool
   - `Helper.ts` connects to Go helper daemon
3. **Renderer** waits for `APP-Ready-To-Show` IPC → receives `global.Server` snapshot → mounts Vue app

### Shutdown Sequence

`app.before-quit` → `Application.stop()` → kill service PIDs → clean hosts file → kill fork processes → destroy tray → `app.quit()`

---

## 2. Core Data Flow: Version Management

### 2.1 Version Fetching (Online → Local)

```
Renderer                    Main                    Fork (Base._fetchOnlineVersion)
  │                          │                       │
  │ IPC: app-fork:php        │                       │
  │ 'fetchAllOnlineVersion'  │                       │
  │─────────────────────────►│                       │
  │                          │ postMessage           │
  │                          │──────────────────────►│
  │                          │                       │ 1. Try static/versions.json
  │                          │                       │    → {app}.{os}.{arch} lookup
  │                          │                       │    → if found, return immediately
  │                          │                       │
  │                          │                       │ 2. Fallback: POST to
  │                          │                       │    api.one-env.com/api/version/fetch
  │                          │                       │    { app, os, arch } → data[]
  │                          │                       │
  │                          │         [             │
  │                          │           { url,       │
  │                          │             version,  │
  │                          │             mVersion } │
  │                          │         ]             │
  │                          │◄──────────────────────│
  │         [...]            │                       │
  │◄─────────────────────────│                       │
  │                          │                       │
  │ localStorage cache       │                       │
  │ (1-hour expiry)          │                       │
```

**Key insight**: Version data is already semi-decentralized via the `static/versions.json` bundle. The API is only a fallback. You can go fully offline by periodically refreshing `static/versions.json` with `scripts/fetch-versions.cjs`.

### 2.2 Installation Flow

```
Renderer (Module.ts)        Fork (Base.installSoft)
  │                          │
  │ IPC: 'installSoft'(row)  │
  │─────────────────────────►│
  │                          │ 1. mkdirp(Cache, AppDir)
  │                          │ 2. if zip exists → skip download
  │  on(progress: {bytes})   │ 3. stream GET → createWriteStream(zip)
  │◄─────────────────────────│    progress via on(row.progress)
  │                          │ 4. _installSoftHandle(row):
  │                          │    Windows: zipUnpack(zip, appDir)
  │                          │    Unix:    unpack(zip, appDir)
  │                          │ 5. Verify: existsSync(row.bin)
  │  code:0, installed:true  │ 6. row.installed = true
  │◄─────────────────────────│
```

### 2.3 Version Discovery (Installed)

```
Fork (Module.allInstalledVersions)
  │
  │ 1. versionLocalFetch(dir, patterns)
  │    → walk directory, find binaries
  │
  │ 2. For each binary: versionBinVersion(bin, regex)
  │    → execute `binary --version`
  │    → parse output with regex
  │    → cache result (BinVersionCache bridge)
  │
  │ 3. Return SoftInstalled[]:
  │    { bin, path, version, num, enable, ... }
```

---

## 3. Version Switching (On-the-Fly, No System PATH)

### Core Principle

SemarEnv **never** modifies the system PATH for version switching. Instead:

1. Every installed version has an **absolute binary path** (e.g., `/opt/SemarEnv-Data/app/nginx-1.24.0/sbin/nginx`)
2. Services are spawned with **full absolute paths** — not relying on PATH resolution
3. Service-specific environment variables are injected at spawn time via `EnvSync`

### Service Start Flow

```
spawn(bin, execArgs, {
  detached: true,
  cwd: serviceWorkDir,
  env: EnvSync.sync()   ← merged env from system + overrides
})
```

`EnvSync` returns a merged environment that includes:
- Current system environment
- `global.Server.Proxy` variables (HTTP_PROXY, etc.)
- Any service-specific env overrides

### Per-Service Version Isolation

Each version runs in its own directory with its own config:

```
{BaseDir}/
  nginx/
    nginx-1.24.0/        ← version 1.24.0 install dir
    nginx-1.26.3/        ← version 1.26.3 install dir
  php/
    php-8.2.32/          ← PHP 8.2 install dir
    php-8.3.32/          ← PHP 8.3 install dir
  pid/
    nginx.pid            ← current running version PID
    php82.pid
    php83.pid
```

### PHP-FPM Multi-Version

PHP achieves multi-version through:
- One PHP-FPM pool per version (different ports/sockets)
- `enable-php-{v}.conf` files auto-generated in nginx config dir
- Nginx vhost config references the correct `enable-php-{v}.conf`

---

## 4. Project/Site System

### Data Model (`AppHost`)

```typescript
interface AppHost {
  id: string
  name: string           // domain (mydomain.test)
  alias: string           // www.mydomain.test
  root: string            // document root path
  type: string            // 'php' | 'java' | 'node' | 'go' | 'python'
  phpVersion: number      // 82 for PHP 8.2
  phpVersionFull: string  // '8.2.32'
  nodeDir: string         // path to Node.js runtime
  pythonDir: string       // path to Python
  jdkDir: string          // path to JDK
  // ports per web server
  nginx: { port: number, ssl: boolean }
  apache: { port: number, ssl: boolean }
  caddy: { port: number, ssl: boolean }
  // environment variables
  envVarType: string
  envVar: string
  // proxy rules
  reverseProxy: AppHostReverseProxyItem[]
}
```

### Site Creation Flow

```
Host.handleHost(host, 'add')
  │
  ├─ _addVhost(host)
  │   ├─ autoFillNginxRewrite(host)  ← detect framework (WP, Laravel, etc.)
  │   ├─ updateAutoSSL(host)          ← SSL cert generation
  │   ├─ makeNginxConf(host)          ← generate nginx vhost
  │   ├─ makeApacheConf(host)         ← generate apache vhost
  │   ├─ makeCaddyConf(host)          ← generate caddy vhost
  │   └─ setDirRole(host.root, 0755)  ← fix permissions
  │
  ├─ HostFile.addHost(host)           ← save to RSA-encrypted host.json
  │
  └─ writeHosts(allHosts)             ← inject into system /etc/hosts
      between #X-HOSTS-BEGIN# and #X-HOSTS-END#
```

### PHP Version Binding

```
nginx vhost template:
  include enable-php.conf;           ← default
  ↓ replace with
  include enable-php-82.conf;        ← version-specific

enable-php-82.conf:
  fastcgi_pass 127.0.0.1:9082;      ← PHP 8.2 FPM socket
```

---

## 5. IPC & Communication Protocol

### Three Channels

| Channel | Transport | Pattern | Use |
|---------|-----------|---------|-----|
| Renderer ↔ Main | `webContents.send` / `ipcMain` | Request-Response + Events | UI commands, config persistence |
| Main ↔ Fork | `utilityProcess.postMessage` | Request-Response + Streaming | Module operations (install, start, stop) |
| Main ↔ Go Helper | Unix socket / Named pipe | Request-Response (one per connection) | System-level ops (hosts, env vars, certs) |

### Message Format

**Renderer → Main:**
```
IPC.send('app-fork:php', 'fetchAllOnlineVersion')
       └──namespace──┘ └─────function──────┘
```

**Main → Fork (postMessage):**
```
[thenKey, moduleName, functionName, ...args]
```

**Main → Go Helper (JSON over socket):**
```json
{
  "key": "uuid",
  "module": "tools",
  "function": "writeFileByRoot",
  "args": ["/etc/hosts", "127.0.0.1..."],
  "ts": 1690000000000,
  "nonce": "uuid",
  "clientPid": 12345,
  "clientExe": "/path/to/SemarEnv",
  "sig": "hex-hmac-sha256"
}
```

### Streaming Responses (ForkPromise)

```
ForkPromise = Promise + .on(callback)
                              ↑
                         streaming progress events
                         (download %, log lines, status changes)
```

---

## 6. Go Helper: Native Privileged Layer

### Why It Exists

Node.js in Electron cannot:
- Write to `/etc/hosts` (requires root)
- Modify `HKLM` registry (Windows system PATH)
- Install CA certificates into system trust store
- Flush DNS cache
- Create scheduled tasks (Windows Task Scheduler)
- Resolve port-to-PID reliably

### Capabilities

| Operation | Module | Function |
|-----------|--------|----------|
| Read/write system PATH (Windows registry) | tools | `getSystemPath`, `setSystemPath` |
| Set system environment variables | tools | `setSystemEnv` (whitelisted keys only) |
| Write to protected files | tools | `writeFileByRoot`, `writeBufferBase64ByRoot` |
| Process listing & killing | tools | `processList`, `kill` |
| Port-to-PID resolution | tools | `getPortPids`, `killPorts` |
| CA cert trust store | host | `sslAddTrustedCert` |
| DNS cache flush | host | `dnsRefresh` |
| Windows Task Scheduler | tools | `setAutoStartWin` |
| macOS login items | tools | `removeLoginItemMac` |
| Symlink creation | tools | `ln_s` (validated paths only) |

### Security Model

1. **Peer credential verification**: `SO_PEERCRED` (Linux), `LOCAL_PEERCRED` (macOS), Named Pipe client PID + SID (Windows)
2. **HMAC-SHA256 signing**: 32-byte random key, one-time generation at `{shared_dir}/semarenv-helper.key`
3. **Nonce replay protection**: UUID nonces, 10-minute expiry window
4. **Timestamp drift**: ±5 minutes tolerance
5. **Argument validation**: Whitelist-based path access (`allow_roots` file), env var key regex, task name validation
6. **Client binding**: Request's `clientPid` must match the connecting peer PID

### Communication Flow

```
Electron (Helper.ts)
  │
  │ 1. Connect to Unix socket / Named pipe
  │ 2. Build TaskItem JSON
  │ 3. Sign with shared HMAC key
  │ 4. Send JSON → close write
  │
  ▼
Go Helper (main.go handleClient)
  │
  │ 1. Verify peer credentials (UID/GID/SID)
  │ 2. Verify client binding (PID + exe path)
  │ 3. Verify HMAC signature
  │ 4. Verify nonce not replayed
  │ 5. Validate arguments
  │ 6. Dispatch to module.function
  │ 7. Return Response JSON
  │ 8. Close connection
  │
  ▼
Electron (Helper.ts)
  │
  │ Read response JSON → resolve/reject
```

### Windows Fallback

When the Go helper is unreachable on Windows, a **PowerShell fallback** (`WindowsHelperFallback.ts`) handles these operations:
- `writeFileByRoot`, `writeBufferBase64ByRoot`
- `setSystemPath`, `setSystemEnv`
- `setAutoStartWin`, `sslAddTrustedCert`
- `rm`

The fallback re-implements the same input validation in TypeScript.

---

## 7. Renderer UI: What Electron Does

### Vue 3 Architecture

```
main.ts
  ↓ wait for IPC 'APP-Ready-To-Show'
  ↓ Object.assign(window.Server, serverState)
  ↓ mount Vue app
  │
  ├─ Pinia Stores: AppStore, BrewStore, SetupStore, HelperStore
  ├─ Vue Router: hash mode, routes auto-generated from AppModules
  │
  └─ Main.vue
       ├─ Aside/Index.vue    (left nav: 50+ modules in categories)
       └─ <router-view/>     (right content: per-module pages)
```

### Module Registration

```
Vite glob: import.meta.glob('@/components/*/Module.ts', { eager: true })
  │
  └─ Each Module.ts exports: AppModuleItem {
       typeFlag,     ← unique ID ('php', 'mysql', 'nginx', ...)
       label,        ← display name
       icon,         ← SVG icon
       aside,        ← nav component (defineAsyncComponent)
       index,        ← main page component
       asideIndex,   ← sort order
       isService,    ← can start/stop
       platform      ← ['macOS', 'Windows', 'Linux']
     }
```

### Key Components

| Component | Role |
|-----------|------|
| `Aside/Index.vue` | Left sidebar: categorized module nav + global start/stop |
| `Host/Index.vue` | Site/project CRUD, import/export, hosts file management |
| `Setup/Index.vue` | Settings: theme, proxy, auto-start, module visibility, editor config |
| `VersionManager/` | Version list UI (brew, port, static, sdkman, local, podman panels) |
| `*\/aside.vue` (54 files) | One per module — nav item with icon, label, running indicator |
| `*\/Index.vue` (54 files) | One per module — main content with tabs (Home, Versions, Config, Logs) |

### What Electron Provides (That Must Be Replaced)

| Electron Feature | Purpose | Replacement Options |
|-----------------|---------|-------------------|
| `BrowserWindow` | Main app window | Tauri window, Wails window, or web browser tab |
| `Tray` | System tray icon + popover | Tauri tray, NW.js tray, or native menu bar app |
| `ipcMain`/`ipcRenderer` | Main ↔ Renderer IPC | Tauri invoke/events, Wails bindings, HTTP+WebSocket |
| `utilityProcess` | Isolated fork processes | Child process (Node.js), sidecar binary |
| `app.setPath('userData')` | Config/data directory | `$HOME/.config/semarenv` or `%APPDATA%/SemarEnv` |
| `shell.openExternal` | Open URLs in browser | Platform-specific `open` command |
| `nativeTheme` | Dark/light theme detection | CSS `prefers-color-scheme`, OS-level query |
| `electron-store` | JSON config persistence | Direct JSON file read/write, SQLite, or confy |
| `autoUpdater` | App auto-update | Platform-specific updater, Sparkle (macOS), MSIX (Windows) |

---

## 8. Configuration & Persistence

### Config File: `user.json`

Stored at Electron `userData` path (`%APPDATA%/SemarEnv/` on Windows, `~/Library/Application Support/SemarEnv/` on macOS).

```json
{
  "setup": {
    "lang": "en",
    "theme": "system",
    "proxy": { "on": false, "proxy": "" },
    "forceStart": false,
    "password": "...",
    "license": "",
    "user_uuid": "",
    "common": { "showItem": { "php": true, "mysql": true, ... } },
    "hosts": { "writeHosts": true }
  },
  "server": {
    "php": { "current": "8.2.32", "dir": "..." },
    "mysql": { "current": "8.0.35", "dir": "..." },
    "nginx": { "current": "1.24.0" }
  },
  "window-state": { "index": { "x": 100, "y": 100, "width": 1200, "height": 800 } },
  "password": "..."
}
```

### Host Data: `host.json`

Stored at `{BaseDir}/host.json`, encrypted with RSA. Contains the full list of virtual hosts/sites.

### Version Cache: `localStorage` (renderer)

```javascript
localStorage['fetchVerion-php'] = JSON.stringify({
  expire: timestamp + 3600,
  data: [OnlineVersionItem, ...]
})
```

1-hour TTL per module type.

---

## 9. What Must Be Preserved vs What Can Be Replaced

### Must Preserve (Core Identity)

| Component | Why | Migration Complexity |
|-----------|-----|---------------------|
| **Go Helper** + IPC protocol | System-level ops (hosts, env vars, certs, registry) | **Low** — already a standalone binary, just needs a new client |
| **Fork module system** (Base + 50 modules) | All version management logic | **Medium** — pure JS/TS logic, portable to any Node.js runtime |
| `global.Server` state object | Shared state contract between all layers | **Low** — just a JSON object |
| `OnlineVersionItem` / `SoftInstalled` types | Core data contracts | **Low** — plain TypeScript interfaces |
| `static/versions.json` bundle | Offline version data | **Low** — static JSON file |
| Per-service config templates | Nginx, Apache, PHP-FPM, MySQL config generation | **Low** — just template rendering |

### Can Replace

| Component | Current | Lightweight Alternative |
|-----------|---------|------------------------|
| Window management | Electron `BrowserWindow` | Tauri `WebviewWindow`, Wails, or system WebView |
| System tray | Electron `Tray` | Tauri `tray`, native menu bar app |
| Config persistence | `electron-store` | Direct JSON file, SQLite, or OS key-value store |
| IPC transport | `ipcMain`/`ipcRenderer` | HTTP + WebSocket (localhost), Unix socket, stdio |
| Fork process pool | `utilityProcess` | Node.js `child_process.fork()`, sidecar |
| Auto-update | `electron-updater` | Platform-native (Sparkle, MSIX), self-updater script |
| UI framework | Vue 3 + Element Plus | **Keep** — already framework-agnostic, works in any browser |

### Go Helper Migration Path

The Go helper is already a standalone binary (`semarenv-helper`). To use it with a non-Electron UI:

1. Keep the Go helper binary **unchanged**
2. Rewrite `Helper.ts` (the client) — currently ~200 lines of pure Node.js socket+HMAC logic
3. Bundle the Go helper with the new app as a sidecar process

---

## 10. Migration Strategy

### Option A: Tauri (Rust + WebView) — Recommended

```
┌──────────────────────────────────┐
│         Tauri (Rust)             │
│  Window management               │
│  System tray                     │
│  File system access              │
│  Process spawning (sidecar)      │
│  IPC (invoke + events)           │
└────────────┬─────────────────────┘
             │ Tauri IPC
┌────────────▼─────────────────────┐
│    Vue 3 Frontend (reuse 90%)    │
│    Same components, stores, router│
└────────────┬─────────────────────┘
             │ Tauri invoke → sidecar
┌────────────▼─────────────────────┐
│    Node.js Sidecar (fork.mjs)    │
│    All 50 fork modules           │
│    Go helper client              │
└────────────┬─────────────────────┘
             │ Unix socket / named pipe
┌────────────▼─────────────────────┐
│    Go Helper Binary (unchanged)  │
└──────────────────────────────────┘
```

**Pros:**
- Keep Vue 3 UI (all 54 modules, 100+ components) — zero rewrite
- Tauri provides window, tray, file system, process spawning
- Rust backend can replace some Go helper functions natively
- Much smaller binary (~10MB vs ~150MB with Electron)
- Lower memory usage (~50MB vs ~200MB)

**Cons:**
- Need Rust knowledge
- Must rewrite `Helper.ts` client in Rust (or keep as Node.js sidecar)
- `child_process.fork()` not available in Tauri's Rust backend — need Node.js sidecar

### Option B: Wails (Go + WebView)

**Pros:** Go backend can directly integrate with the existing Go helper code.

**Cons:** Less mature than Tauri, smaller ecosystem.

### Option C: Minimal Electron (keep what works)

Stay on Electron but strip everything non-essential:
- Remove unused Node.js deps
- Lazy-load modules
- Use system WebView where possible
- Compress assets

### Option D: NW.js or Neutralinojs

Lightweight alternatives with similar APIs.

### Recommended Approach

**Phase 1 (now):** Keep Electron, but prepare by:
1. Moving fork modules to a standalone Node.js process (already mostly done via utilityProcess)
2. Decoupling renderer from Electron-specific APIs (use abstraction layer)
3. Replacing `electron-store` with generic JSON file storage
4. Replacing `ipcMain`/`ipcRenderer` with a transport-agnostic event bus

**Phase 2:** Port to Tauri:
1. Create Tauri app shell (window, tray, menu)
2. Run fork modules as Node.js sidecar process
3. Connect Vue 3 frontend via Tauri `invoke` + WebSocket for streaming
4. Keep Go helper binary unchanged

**Phase 3:** Optimize:
1. Port Go helper functions to Tauri Rust commands where possible
2. Reduce sidecar overhead

---

## 11. File Reference Index

### Main Process
| File | Role |
|------|------|
| `src/main/Launcher.ts` | Entry: single-instance lock, app lifecycle |
| `src/main/Application.ts` | Orchestrator: owns all subsystems, start/stop |
| `src/main/core/ConfigManager.ts` | electron-store wrapper → user.json |
| `src/main/core/ServerManager.ts` | Builds global.Server, directory setup, proxy |
| `src/main/core/IPCHandler.ts` | Command routing (renderer ↔ main ↔ fork) |
| `src/main/core/ForkManager.ts` | utilityProcess pool manager |
| `src/main/ui/WindowManager.ts` | BrowserWindow factory + lifecycle |
| `src/main/ui/TrayManager.ts` | System tray (classic/modern) |
| `src/main/utils/ServerPath.ts` | Computes all directory paths |

### Fork Modules
| File | Role |
|------|------|
| `src/fork/index.ts` | Fork entry point, bridge clients |
| `src/fork/BaseManager.ts` | Module dispatch (lazy-load singleton pool) |
| `src/fork/module/Base/index.ts` | Base class: exec(), _fetchOnlineVersion(), installSoft() |
| `src/fork/module/Host/index.ts` | Site CRUD, hosts file management |
| `src/fork/module/{App}/index.ts` | 50+ modules, each: fetchVersions, install, start, stop |
| `src/fork/util/Version.ts` | versionLocalFetch, versionBinVersion |
| `src/fork/util/ServiceStart.ts` | serviceStartSpawn (detached process spawner) |

### Renderer
| File | Role |
|------|------|
| `src/render/main.ts` | Vue bootstrap, wait for APP-Ready-To-Show |
| `src/render/router/index.ts` | Hash router, auto-routes from AppModules |
| `src/render/core/type.ts` | `AppModuleEnum` (55 entries), `AppModuleItem` |
| `src/render/core/App.ts` | `import.meta.glob` all Module.ts files |
| `src/render/core/Module/Module.ts` | Module class: fetch, install, start, stop, version tracking |
| `src/render/store/app.ts` | Pinia: config, hosts, preferences |
| `src/render/store/brew.ts` | Pinia: Module singleton factory, version cache |
| `src/render/util/Brew.ts` | Version fetch with localStorage cache |
| `src/render/util/IPC.ts` | IPC client (then-able, not real Promise) |

### Go Helper
| File | Role |
|------|------|
| `src/helper-go/main.go` | Listener, HMAC verify, dispatch |
| `src/helper-go/utils/peer_*.go` | Platform-specific peer credential verification |
| `src/helper-go/module/tool.go` | PATH, env vars, processes, file I/O, scripts |
| `src/helper-go/module/host.go` | SSL certs, DNS flush |
| `src/helper-go/utils/whitelist.go` | Path validation allowlist |

### Shared (Main + Fork)
| File | Role |
|------|------|
| `src/shared/app.d.ts` | AppHost, SoftInstalled, OnlineVersionItem types |
| `src/shared/ForkPromise.ts` | Promise + .on() streaming |
| `src/shared/child-process.ts` | spawn/exec wrappers with EnvSync |
| `src/shared/Process.ts` | Process tree, port-to-PID, kill |
| `src/shared/EnvSync.ts` | Environment snapshot manager |
| `src/shared/AppHelperCheck.ts` | HMAC signing, key management |

---

## Summary: Data Flow Diagram

```
User clicks "Install PHP 8.3"
        │
        ▼
Renderer: Module.ts.install(item)
  IPC: app-fork:php 'installSoft' {url, zip, appDir, bin}
        │
        ▼
Main: IPCHandler → ForkManager.send('php', 'installSoft', row)
  postMessage: [thenKey, 'php', 'installSoft', row]
        │
        ▼
Fork: BaseManager.exec → Php.installSoft(row)
  Base.installSoft(row):
    1. mkdirp cache + app dirs
    2. Download: GET url → stream → writeFile(zip)
       on({ progress: 45 })
    3. Unpack: zipUnpack(zip, appDir)
    4. Verify: existsSync(bin)
    5. allInstalledVersions() ← find + parse version
    6. resolve({ installed: true, version: '8.3.32' })
        │
        ▼
Renderer receives code:0 → updates UI → version available

User clicks "Start PHP 8.3"
        │
        ▼
Renderer: Module.ts.start(version)
  IPC: app-fork:php 'startService' version
        │
        ▼
Fork: Php.startService(version)
  1. Validate bin exists
  2. _stopServer(oldVersion)  ← kill old FPM
  3. Generate enable-php-83.conf
  4. _startServer(version):
     spawn(bin, args, { detached, env: EnvSync.sync() })
  5. Save PID to pid/php83.pid
  6. Update global.Server.PhpDir
  7. resolve({ running: true })
        │
        ▼
Renderer updates tray icon (gray → green)
```

---

*Generated from SemarEnv codebase analysis. Last updated: 2026-07-20.*
