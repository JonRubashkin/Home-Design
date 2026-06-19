// Vertical stacking offsets for the 3D preview (meters).
//
// Surfaces that are meant to read as separate must never share an exact world
// Y, or the depth buffer can't decide which is in front and they z-fight
// (shimmer) as the camera orbits. Each layer here sits a few mm above the one
// it rests on. These are FIXED per-category base lifts — not auto-stacking:
// we don't raise an item to the height of whatever it's placed over (that's
// out of scope), we just keep the base layers cleanly separated so manual
// overlap renders without flicker.
//
// Order (low -> high): ground plane < floor regions < flat items (rugs/mats)
// < regular furniture. Keep ≥ a few mm between consecutive layers.

export const GROUND_Y = -0.02; // infinite ground plane, below everything
export const FLOOR_LIFT = 0.006; // floor regions, above the ground plane
export const FLAT_ITEM_LIFT = 0.012; // rugs/mats, clearly above floor regions
export const ITEM_LIFT = 0.018; // regular furniture, above the flat-item layer
export const STACK_LIFT = 0.002; // an item resting on another item's surface top

// Clearance the roof's underside sits ABOVE the top level's wall tops. A flat
// roof slab would otherwise sit exactly at the wall-top plane (elevation +
// wallHeight) and z-fight with the wall tops as the camera orbits; lifting every
// roof type by this much also keeps sloped-roof eave edges off that plane. Small
// enough to be invisible on a roof, large enough to settle the depth buffer
// (mirrors how the floor lifts above separate the floor layers).
export const ROOF_LIFT = 0.02;
