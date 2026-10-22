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
const {
  runBoundedBatch,
} = require("../.feature-test-build/utils/bounded-batch.js");

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

test("bounded batch limits concurrency and preserves partial successes", async () => {
  let active = 0;
  let maximumActive = 0;
  const calls = [];
  const progress = [];

  const results = await runBoundedBatch(
    ["a", "b", "c", "d", "e"],
    async (item, index) => {
      calls.push(index);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      if (index === 2) throw new Error("expected failure");
      return item.toUpperCase();
    },
    3,
    (result) => {
      progress.push(result.status);
    }
  );

  assert.equal(maximumActive, 3);
  assert.deepEqual(calls.sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  assert.deepEqual(
    results.map((result) => result.status),
    ["fulfilled", "fulfilled", "rejected", "fulfilled", "fulfilled"]
  );
  assert.equal(progress.length, 5);
  assert.equal(progress.filter((status) => status === "fulfilled").length, 4);
  assert.equal(progress.filter((status) => status === "rejected").length, 1);
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
