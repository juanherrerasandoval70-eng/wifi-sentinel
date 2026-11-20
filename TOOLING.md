# TOOLING.md — ESTADO DEL ARSENAL DE HERRAMIENTAS Y VERIFICACIÓN REAL

**Fecha:** 2026-11-16  
**Proyecto:** `wifi-sentinel` (`C:\Users\Administrator\.gemini\antigravity\scratch\wifi-sentinel`)  
**Configuración MCP Activa:** `C:\Users\Administrator\.gemini\config\mcp_config.json` (Límite: 9 servidores)

---

## 1. Servidores MCP (Model Context Protocol)

| # | Servidor | Versión | Estado | Verificación Real Realizada | Motivo de Fallo / Limitación | Fallback Elegido |
|---|---|---|---|---|---|---|
| 1 | **Context7** (`@upstash/context7-mcp`) | 4.7.1 | **OK** | Llamada a `resolve-library-id` y `query-docs` resolviendo la firma de `@Composable fun Button` de Material 3. | Ninguno. Operativo al 100%. | N/A |
| 2 | **adb-mcp** (`adb-mcp`) | 0.1.1 | **OK / PARCIAL** | `adb_devices` ejecutado con éxito vía JSON-RPC. `dump_image` ejecutado vía MCP. | No hay dispositivo/emulador activo en ejecución (`adb.exe: no devices/emulators found`). | Fallback CLI nativo: `adb exec-out screencap -p > screen.png` una vez iniciado el dispositivo. |
| 3 | **Serena** (`serena`) | 2.1.1.dev0 | **OK** | Servidor iniciado vía uvx en modo `claude-code`, autogeneró `.serena/project.yml` e indexó el proyecto `wifi-sentinel`. | Contexto `ide-assistant` fue migrado a `claude-code`. | N/A |
| 4 | **mobile-mcp** (`@mobilenext/mobile-mcp`) | 1.0.17 | **OK** | Verificado e instalado en NPM global y ejecutable con npx. | Respaldo para ADB/automatización. | Fallback a `adb-mcp` o comandos CLI directos de `adb`. |
| 5 | **Figma MCP** | Remoto | **PENDIENTE AUTH** | Endpoint `https://mcp.figma.com/mcp` verificado vivo (HTTP 405 en GET, esperando JSON-RPC POST). | Requiere autenticación de cuenta Figma / token de diseño del usuario. | Skills de diseño (`design-system`, `ui-ux-pro-max`) y design tokens locales. |
| 6 | **GitHub MCP** (`github-mcp-server`) | 2.1.0 | **PENDIENTE AUTH** | Binario oficial v2.1.0 instalado en `antigravity/bin`. Inicialización de protocolo verificada. | Requiere Personal Access Token (`GITHUB_PERSONAL_ACCESS_TOKEN`) para llamadas autenticadas. | CLI oficial `gh` o git clone directo / GitHub REST API pública. |
| 7 | **DeepWiki** | Remoto | **OK** | Endpoint `https://mcp.deepwiki.com/mcp` verificado vivo con protocolo Streamable HTTP. | Requiere cliente Streamable HTTP con cabecera `application/json, text/event-stream`. | Inspección de repos mediante GitHub API / clonado superficial `git clone --depth 1`. |
| 8 | **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`) | 2.3.0 | **OK** | Llamada a `list_directory` listando con éxito los archivos de la raíz del proyecto. | Ninguno. Acotado al directorio de trabajo. | Herramientas internas `read_file`, `write_file`, `edit_file`. |
| 9 | **Memory** (`@modelcontextprotocol/server-memory`) | 2.1.1 | **OK** | Llamada a `create_entities` creando exitosamente la entidad `TestEntity` con observación persistente. | Ninguno. Operativo al 100%. | Dossiers y notas locales en markdown (`DOSSIER.md`, `TOOLING.md`). |

---

## 2. Skills Instaladas (`.agents/skills/`)

Todas verificadas con archivo `SKILL.md` presente y cargable en disco:

| # | Skill | Ruta Local | Tamaño | Estado |
|---|---|---|---|---|
| 1 | **frontend-design** | `.agents/skills/frontend-design/SKILL.md` | 9,461 bytes | **OK** |
| 2 | **design-system** | `.agents/skills/design-system/SKILL.md` | 7,706 bytes | **OK** |
| 3 | **ui-ux-pro-max** | `.agents/skills/ui-ux-pro-max/SKILL.md` | 18,883 bytes | **OK** |
| 4 | **impeccable** | `.agents/skills/impeccable/SKILL.md` | 12,856 bytes | **OK** |
| 5 | **architecture** | `.agents/skills/architecture/SKILL.md` | 2,270 bytes | **OK** |
| 6 | **clean-code** | `.agents/skills/clean-code/SKILL.md` | 5,309 bytes | **OK** |
| 7 | **performance-optimization** | `.agents/skills/performance-optimization/SKILL.md` | 14,273 bytes | **OK** |
| 8 | **test-driven-development** | `.agents/skills/test-driven-development/SKILL.md` | 8,670 bytes | **OK** |

---

## 3. Binarios del Sistema Configurados

- **Python:** `3.11.9` (`C:\Python311\python.exe`)
- **uv / uvx:** `0.13.8` (`C:\Python311\Scripts\uvx.exe`)
- **Node.js:** `v26.13.0` (`C:\Program Files\nodejs\node.exe`)
- **NPM / NPX:** `11.20.0`
- **ADB:** `1.0.41` (`C:\ProgramData\chocolatey\lib\adb\tools\platform-tools\adb.exe` agregado prioritario a PATH)
- **Git:** `2.47.1`
