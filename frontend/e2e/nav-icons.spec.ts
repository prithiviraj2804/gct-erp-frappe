import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { MODULE_ICONS, NAV_ICONS } from '../src/shell/lib/module-icons'

/**
 * The workspace data and the icon map must agree.
 *
 * This exists because the failure mode of that map is SILENCE. `navIcon` returns undefined for an
 * unregistered name and the renderer draws nothing — no error, no fallback glyph, just a row that
 * quietly has no icon while every row around it does. Four names had drifted out of sync before
 * anyone noticed, and two of them were registered as group icons while rendering blank as screen
 * icons.
 *
 * A DEV console warning covers the person who happens to be looking. This covers everyone else.
 *
 * It is a node test, not a browser one — Playwright is simply the only runner this app has, and
 * reading two files is cheaper here than adding a second test framework for it.
 */

// The project is ESM ("type": "module"), so there is no __dirname. Derived from import.meta
// instead — the same reason vite.config.ts does it this way.
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

interface WorkspaceLink {
  type?: string
  label?: string
  icon?: string | null
}

function workspaceFiles(): string[] {
  const out: string[] = []
  const modules = join(APP_ROOT, 'erp')
  for (const mod of readdirSync(modules, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue
    const dir = join(modules, mod.name, 'workspace')
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue // most modules have no workspace
    }
    for (const ws of entries) {
      if (ws.isDirectory()) out.push(join(dir, ws.name, `${ws.name}.json`))
    }
  }
  return out
}

test('every workspace icon name is registered in NAV_ICONS', () => {
  const unregistered: string[] = []

  for (const file of workspaceFiles()) {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { links?: WorkspaceLink[] }
    for (const link of doc.links ?? []) {
      if (!link.icon) continue // an icon is optional; an UNKNOWN one is the bug
      if (!(link.icon in NAV_ICONS)) {
        unregistered.push(`${link.icon}  (${link.type} "${link.label}" in ${file.split('/erp/')[1]})`)
      }
    }
  }

  // Named rather than counted, so the failure message is the fix.
  expect(unregistered, `Add these to NAV_ICONS in src/shell/lib/module-icons.ts:\n  ${unregistered.join('\n  ')}`).toEqual([])
})

test('every module in modules.txt has a rail icon', () => {
  const modules = readFileSync(join(APP_ROOT, 'erp', 'modules.txt'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // `Erp` is the app's own catch-all module and is never shown in the rail.
    .filter((name) => name !== 'Erp')

  const missing = modules.filter((name) => !(name in MODULE_ICONS))

  // A module with no entry falls back to a generic box — legible, but it makes every new module
  // look unfinished until someone notices. This is how `Student` shipped without one.
  expect(missing, `Add these to MODULE_ICONS in src/shell/lib/module-icons.ts: ${missing.join(', ')}`).toEqual([])
})

test('NAV_ICONS carries no entry the workspaces do not use', () => {
  const used = new Set<string>()
  for (const file of workspaceFiles()) {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { links?: WorkspaceLink[] }
    for (const link of doc.links ?? []) if (link.icon) used.add(link.icon)
  }

  const orphans = Object.keys(NAV_ICONS).filter((name) => !used.has(name))

  // The map exists to keep the bundle small by listing only what ships. An entry nothing uses is
  // an icon imported for nothing — small individually, and the reason the list is worth pruning.
  expect(orphans, `Unused in every workspace — remove from NAV_ICONS: ${orphans.join(', ')}`).toEqual([])
})
