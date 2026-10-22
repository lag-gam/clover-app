const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const {
  filterSaved,
  persistedDisplaySide,
  replaceDisplayedItem,
  resolveGarmentImage,
} = require("../.feature-test-build/utils/outfit-state.js");
const {
  weightedAverageVectors,
} = require("../.feature-test-build/utils/math.js");

const garment = {
  image_url: "front-original",
  cutout_url: "front-cutout",
  back_image_url: "back-original",
  back_cutout_url: "back-cutout",
};

test("front/back side persists and resolves with safe fallback", () => {
  assert.equal(persistedDisplaySide(undefined), "front");
  assert.equal(persistedDisplaySide("back"), "back");
  assert.equal(resolveGarmentImage(garment, "back"), "back-cutout");
  assert.equal(
    resolveGarmentImage(
      { ...garment, back_image_url: null, back_cutout_url: null },
      "back"
    ),
    "front-cutout"
  );
});

test("calendar filtering excludes ephemeral outfits", () => {
  assert.deepEqual(
    filterSaved([
      { id: "shown", is_saved: false },
      { id: "manual", is_saved: true },
    ]).map(({ id }) => id),
    ["manual"]
  );
});

test("swap keeps item identity and resets orientation", () => {
  const [item] = replaceDisplayedItem(
    [
      {
        outfit_item_id: "durable-item",
        garment: { id: "removed" },
        display_side: "back",
      },
    ],
    "removed",
    { id: "replacement" }
  );
  assert.equal(item.outfit_item_id, "durable-item");
  assert.equal(item.garment.id, "replacement");
  assert.equal(item.display_side, "front");
});

test("signed preference evidence is finite and directional", () => {
  assert.deepEqual(
    weightedAverageVectors(
      [
        [1, 0],
        [0, 1],
      ],
      [1, -1]
    ),
    [0.5, -0.5]
  );
  assert.deepEqual(
    weightedAverageVectors([[1, 2], [Number.NaN, 4]], [1, -1]),
    [1, 2]
  );
});

test("durable swap RPC enforces authenticated ownership", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/012_durable_outfit_swaps.sql", `file://${__filename}`)
      .pathname,
    "utf8"
  );
  assert.match(sql, /owner_id UUID := auth\.uid\(\)/);
  assert.match(sql, /outfit\.user_id = owner_id/);
  assert.match(sql, /display_side = 'front'/);
  assert.match(sql, /GRANT EXECUTE .* TO authenticated/);
});
