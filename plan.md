# Rencana Teknis Rebranding ke SemarEnv dan Drop AI Manager

## Tujuan
1. Rebrand kode dan UI dari `FlyEnv` menjadi `SemarEnv`.
2. Hapus atau disable semua fitur AI manager / MCP / AI coding CLI integration.
3. Pertahankan fitur inti manajemen lokal: runtime, server, database, proxy, project workflows.
4. Pastikan perubahan tetap kompilable dan dapat dibangun.

## Branding
- **SemarEnv**: nama lebih pendek dan filosofis. Semar meski berwujud "gemuk" (banyak fitur/utility di dalamnya), namun bijak dan menjadi penasihat andalan di balik layar — persis seperti role environment manager yang menangani banyak hal tapi tetap simpel dipakai.

## 1. Audit Teknis

### 1.1. Cari referensi utama
- `FlyEnv`, `flyenv`, `flyenv.com`
- `MCP`, `mcp`, `AI`, `ai`, `Copilot`, `Claude Code`, `Codex`, `Kimi`, `Antigravity`, `OpenCode`, `Ollama`, `OpenClaw`, `Hercules`, `N8N`, `Hermes`, `tunneling`, `tunnel`

### 1.2. Fokus file
- `package.json`
- `README.md`, `AGENTS.md`, `DEV.md`
- `src/main/index.ts`
- `src/main/configs/page.ts`
- `src/main/ui/TrayManager.ts`
- `src/main/core/*.ts`
- `src/main/menus/darwin.json`
- `src/render/components/**`
- `src/render/core/**`
- `src/lang/**`

## 2. Rebranding

### 2.1. Metadata dan aplikasi
- `package.json`
  - `name`: dari `FlyEnv` ke `SemarEnv`
  - `description`: update deskripsi menjadi SemarEnv
  - `author` / `copyright` jika perlu
- `src/main/configs/page.ts`
  - `title`: `SemarEnv`
- `src/main/ui/TrayManager.ts`
  - `tray.setToolTip('FlyEnv')` → `tray.setToolTip('SemarEnv')`
- `src/main/index.ts`
  - `FlyEnv-Data` → `SemarEnv-Data` (pertimbangkan migrasi data / compat)
- `src/main/core/RunPath.ts`
  - `FlyEnv` path and data directory usage
- `src/main/core/AppHelper.ts`
  - helper path and plist names containing `flyenv`
- `src/main/core/ExceptionHandler.ts`
  - log prefix dari `[FlyEnv]` ke `[SemarEnv]`
- `src/main/core/AppNodeFn.ts` dan `src/main/core/Logger.ts`
  - jika ada nama aplikasi string
- `src/main/Launcher.ts` dan `src/main/app.ts`
  - path launch flag atau paths yang menyimpan FlyEnv

### 2.2. UI dan dokumentasi
-- `README.md`, `AGENTS.md`, `DEV.md`
  - semua referensi FlyEnv → SemarEnv
- `src/lang/*/menu.json`
  - pastikan teks menu app / hide / quit tidak menyebut FlyEnv jika hardcoded
- `src/lang/*/setup.json`, `src/lang/*/common.json`, dan file lain dengan `FlyEnv` secara langsung
- `src/render/components/Setup/FlyEnvHelper/index.vue`
  - label UI tetap valid; ganti teks yang menyebut FlyEnv jika ada
- `src/render/components/Setup/Common.vue` / `src/render/components/Setup/AI/index.vue`
  - update label jika ada

### 2.3. Path / storage keys
- Cari kunci localStorage / cache dengan prefix `flyenv-`
  - contoh `flyenv-projects-dirs`, `flyenv-licenses-post-message`
- Pertimbangkan tidak merubah keys langsung untuk backward compatibility kecuali dikomunikasikan.
- Di plan, catat bahwa data migrasi harus disiapkan bila mengganti `flyenv-*` keys.

## 3. Drop AI manager dan MCP

### 3.1. Stop bootstrap MCP
- `src/main/Application.ts`
  - Hentikan pembuatan `MCPConfigManager`, `MCPServer`, `MCPBridgeManager`
  - Hentikan panggilan `startMcpOnLaunchIfNeeded`
  - Hentikan semua `mcpServer` / `mcpBridgeManager` dependency injection ke `IPCHandler`
- `src/main/core/IPCHandler.ts`
  - Hapus handler `mcp:start`, `mcp:stop`, `mcp:status`, `mcp:get*`, `mcp:*`
  - Hapus `mcpConfigManager`, `mcpBridgeManager`, `mcpServer` dari dep injection
- `src/main/core/MCPConfigManager.ts`, `MCPServer.ts`, `MCPBridgeManager.ts`, `MCPTools.ts`, `MCPContextResolver.ts`, `MCPLifecycle.ts`, `MCPAudit.ts`, `mcpToolMetadata.ts`
  - Hapus jika ingin bersih, atau tandai sebagai deprecated/archived
  - Jika tidak dihapus, pastikan tidak di-build atau diimport lagi oleh runtime

### 3.2. Nonaktifkan UI MCP dan AI pages
- Hapus/disable `src/render/components/MCP/**/*`
  - `ASide.ts`, `aside.vue`, `Index.vue`, `Audit.vue`, `ClientConfig.vue`, `Service.vue`, `Tools.vue`, `setup.ts`, `Module.ts`
- Hapus/disable menu dan routing ke MCP page
- Hapus/disable `ShowAI` dan related setup UI (misalnya `src/render/components/Setup/AI/index.vue`)
- Hapus `src/render/components/Setup/Common.vue` reference ke show AI

### 3.3. Nonaktifkan semua modul AI/AI coding
- Hapus/disable komponen dan modul berikut dari UI dan registry:
  - `src/render/components/CopilotCli/**`
  - `src/render/components/ClaudeCode/**`
  - `src/render/components/Codex/**`
  - `src/render/components/Kimi/**`
  - `src/render/components/Antigravity/**`
  - `src/render/components/OpenCode/**`
  - `src/render/components/Ollama/**`
  - `src/render/components/OpenClaw/**`
  - `src/render/components/Hermes/**`
  - `src/render/components/N8N/**`
- Hapus semua fitur tunneling / tunnel-related UI dan setup yang masih ada di kategori AI / remote service integration.
- OpenClaw harus dibersihkan sepenuhnya, termasuk semua UI, setup, command list, dan referensi dokumentasi internal.
- Hapus modul `ai` / `aiCoding` dari registri modul jika ada (render module list / route config).
- Hapus rujukan ke `MCP.vue` di masing-masing package, karena MCP tidak akan ada lagi.

### 3.4. Hentikan AI tool setup dan install commands
- `src/render/components/CopilotCli/setup.ts`, `CopilotCli/install.ts`
- `src/render/components/ClaudeCode/setup.ts`
- `src/render/components/Codex/setup.ts`
- `src/render/components/Kimi/setup.ts`
- `src/render/components/Antigravity/setup.ts`
- `src/render/components/OpenCode/setup.ts`
- `src/render/components/Hermes/setup.ts`
- `src/render/components/Ollama/setup.ts`
- `src/render/components/OpenClaw/setup.ts`
- `src/render/components/N8N/setup.ts`

### 3.5. Hapus plugin/CLI language files
- `src/lang/*/ai.json`
- `src/lang/*/mcp.json`
- `src/lang/*/copilot-cli.json`
- `src/lang/*/claude-code.json`
- `src/lang/*/codex.json`
- `src/lang/*/antigravity.json`
- `src/lang/*/kimi.json`
- `src/lang/*/open-code.json`
- `src/lang/*/ollama.json`
- `src/lang/*/openclaw.json`
- `src/lang/*/hermes.json`
- `src/lang/*/n8n.json` jika N8N dianggap bagian dari AI manager
- Perbarui `src/lang/index.ts` untuk menghapus import/type declarations

### 3.6. Bersihkan referensi OpenClaw tambahan
- `src/fork/module/OpenClaw/index.ts`
- `src/render/components/OpenClaw/command.json`
- `src/render/components/OpenClaw/Config.vue`
- `src/render/components/OpenClaw/Index.vue`
- `src/render/components/OpenClaw/Module.ts`
- `src/render/components/OpenClaw/Service.vue`
- `src/render/components/OpenClaw/setup.ts`
- `src/render/components/OpenClaw/ASide.ts`
- `src/render/components/OpenClaw/aside.vue`
- `src/render/core/type.ts` / module registry entry `openclaw`
- Semua dokumentasi internal yang menyebut `OpenClaw` (misalnya `docs/deepwiki/openclaw.md` jika ingin bersih total)

### 3.7. Deep clean checklist
- Lakukan audit `grep` khusus untuk:
  - `CloudflareTunnel`, `cloudflare-tunnel`, `cloudflared`
  - `tunneling`, `tunnel`, `ngrok`, `nrok`, `zero`
  - `OpenClaw`, `MCP`, `aiCoding`, `AI manager`
- Hapus atau taruh di status `deprecated` semua file implementasi yang tidak lagi digunakan:
  - `src/fork/module/CloudflareTunnel/**`
  - `src/fork/module/Cloudflared/**`
  - `src/render/components/CloudflareTunnel/**`
  - `src/render/components/Cloudflared/**`
  - `src/main/core/mcpToolMetadata.ts`
  - `src/render/core/CloudflareTunnel/**`
- Hapus semua route / sidebar / menu / registry entry untuk module networkTunnel / cloudflare-tunnel / cloudflared.
- Hapus semua lokalizations/host strings yang masih menampilkan tunnel module labels.
- Pastikan tidak ada `spawn('cloudflared')`, `app-fork:cloudflare-tunnel`, atau `app-fork:cloudflared` IPC event listener yang tersisa.
- Audit `src/render/core/type.ts` untuk module enum dan `src/fork/BaseManager.ts` untuk module loader.
- Audit dokumentasi online/internal untuk istilah tunneling dan tekankan `no public/external tunnel` policy.

## 4. Detil Implementasi Rebrand

### 4.1. Ganti string aplikasi di kode utama
- `src/main/ui/TrayManager.ts` → `FlyEnv` tooltip
- `src/main/configs/page.ts` → title
- `src/main/index.ts` → userData path `FlyEnv-Data`
- `src/main/core/AppHelper.ts` → `com.flyenv.helper.plist`, `flyenv-helper` path
- `src/main/core/RunPath.ts` → path `FlyEnv` dan `FlyEnv-Data`
- `src/main/core/ExceptionHandler.ts` / `src/main/core/Logger.ts` → log prefix

### 4.2. Perbarui semua label UI teks hardcoded
- `src/lang/*/menu.json`
- `src/lang/*/setup.json`
- `src/lang/*/common.json`
- `src/lang/*/base.json`
- `src/lang/*/tools.json`
- `src/lang/*/prompt.json` ketika berisi referensi FlyEnv

### 4.3. Pertimbangkan asset / icon
- Cari di `build/`, `public/`, `static/` aset yang dinamai `flyenv` atau menunjukkan logo FlyEnv
- Jika ingin rebrand visual, ganti icon dan nama file aset yang terlihat pengguna

## 5. Validasi dan Testing

### 5.1. Build dan lint
- `yarn dev` (jalankan dan lihat error runtime)
- `yarn build` (pastikan compile berhasil)
- Jika ada linter, jalankan `yarn lint` atau sesuai config

### 5.2. Pemeriksaan string
- Jalankan grep untuk sisa `FlyEnv` / `flyenv`
- Jalankan grep untuk sisa `MCP` / `mcp` / `AI` / nama AI tools

### 5.3. Verifikasi UI
  - Pastikan menu aplikasi sekarang menampilkan `SemarEnv`.
  - Pastikan tray tooltip menampilkan `SemarEnv`.
- Pastikan halaman `MCP` dan semua AI tools tidak lagi tersedia di UI.
- Pastikan setup module list hanya memuat modul lingkungan dev, bukan AI modules.

### 5.4. Data compatibility
- Pastikan bila mempertahankan `flyenv-*` data keys, aplikasi masih dapat membaca data lama.
 - Jika mengganti data path ke `SemarEnv-Data`, buat migrasi atau fallback bila direktori lama ada.

## 6. Prioritas Pelaksanaan
1. Audit semua referensi string dan file target.
2. Implementasikan rebrand metadata dan title/tooltip UI.
3. Matikan MCP bootstrap dan remove AI menu/route.
4. Hapus/disable modul AI render dan bahasa.
5. Jalankan build, lalu bersihkan sisa referensi.
6. Uji aplikasi end-to-end.

## 7. Catatan Tambahan
- Jika tujuan hanya menonaktifkan AI tanpa menghapus seluruh kode, prioritaskan removal dari UI & bootstrap saja; biarkan file AI tetap ada sebagai kode mati sampai tahap selanjutnya.
- Jika ingin hasil bersih, setelah UI dinonaktifkan, lakukan penghapusan file modul AI dan `src/main/core/MCP*` di commit terpisah.
- Jangan ubah `localStorage`/`electron-store` keys yang penting secara mendadak tanpa strategi migrasi.
