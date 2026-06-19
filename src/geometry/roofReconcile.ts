import type { RoofSection, Vec2, Wall } from "../model/types";
import { createRoofSection } from "../model/defaults";
import { pointInPolygon } from "./polygon";
import { detectMasses } from "./roofMass";

// Reconcile a level's roof sections against its current wall masses (Phase 5.1).
// Called after any structural wall change (add/remove/move, room/copy, level
// add/remove). Pure so it is unit-tested in isolation.
//
// Rules:
//  - A mass whose footprint contains an existing section's `anchor` keeps that
//    section (its type/pitch/etc. persist); the section re-anchors to the mass's
//    representative point so it tracks the mass as it grows.
//  - A section whose anchor is inside no current mass is orphaned and removed.
//  - A mass with no section is auto-created with default settings UNLESS the user
//    removed its section (its anchor is in `suppressed`) — then it stays bare so a
//    removed roof doesn't instantly respawn. Suppression is dropped once the
//    mass's walls move out from under the anchor (it no longer matches a mass).

export interface ReconcileResult {
  sections: RoofSection[];
  suppressed: Vec2[]; // anchors of masses the user un-roofed (no auto-respawn)
}

export function reconcileRoofSections(
  walls: Wall[],
  sections: RoofSection[],
  suppressed: Vec2[] = [],
): ReconcileResult {
  const masses = detectMasses(walls);
  const covered = new Set<number>();
  const out: RoofSection[] = [];

  // 1. Keep sections still sitting over a mass; re-anchor to track the mass.
  for (const sec of sections) {
    const mi = masses.findIndex(
      (m, i) => !covered.has(i) && pointInPolygon(sec.anchor, m.footprint),
    );
    if (mi >= 0) {
      out.push({ ...sec, anchor: { ...masses[mi]!.anchor } });
      covered.add(mi);
    }
    // else: orphaned — drop.
  }

  // 2. Carry "removed" suppression for any still-bare mass that still contains a
  //    suppressed anchor (its walls haven't changed out from under it).
  const nextSuppressed: Vec2[] = [];
  for (let i = 0; i < masses.length; i++) {
    if (covered.has(i)) continue;
    if (suppressed.some((a) => pointInPolygon(a, masses[i]!.footprint))) {
      nextSuppressed.push({ ...masses[i]!.anchor });
      covered.add(i);
    }
  }

  // 3. Auto-create a default section for every remaining (newly appeared) mass.
  for (let i = 0; i < masses.length; i++) {
    if (covered.has(i)) continue;
    out.push(createRoofSection(masses[i]!.anchor));
  }

  return { sections: out, suppressed: nextSuppressed };
}
