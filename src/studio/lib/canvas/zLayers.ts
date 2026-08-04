/**
 * Stacking order for the canvas surfaces.
 *
 * These used to be inline `z-[90]` / `z-50` / `z-[120]` literals scattered
 * across five components that all dock to the same corner, so the only way to
 * know what covered what was to grep for numbers. Named here so a new panel has
 * somewhere obvious to slot in.
 */
export const Z_RIGHT_DOCK = 50; // RightStudioPanel, VariantsPanel, PublishPanel
export const Z_CANVAS_CHROME = 60; // frame hover controls
export const Z_ALLY_DOCK = 80; // CanvasAllyDock
export const Z_BRIEF_DOCK = 90; // BriefChatPanel
export const Z_QUALIFY = 110; // the qualifying thread — above every dock
export const Z_PILL = 120; // AgentPill stays reachable above all of it
