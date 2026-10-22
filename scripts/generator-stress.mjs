import assert from "node:assert/strict";
import { generateOutfitCandidates } from "../src/services/outfit.service.ts";

let nextId = 1;
function garment(category, subtype, overrides = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    user_id: "00000000-0000-4000-8000-000000000000",
    name: `${subtype ?? category} ${nextId}`,
    category,
    subtype,
    metal_tone: category === "accessories" ? "silver" : "none",
    color: "black",
    secondary_color: null,
    pattern: "solid",
    material: "cotton",
    fit: "regular",
    formality: 2,
    image_url: "https://example.com/original.png",
    cutout_url: "https://example.com/cutout.png",
    embedding: [1, 0, 0],
    tags: ["test"],
    processing_status: "ready",
    processing_attempts: 1,
    processing_error: null,
    processing_started_at: null,
    processing_completed_at: new Date(0).toISOString(),
    section_id: "00000000-0000-4000-8000-000000000001",
    position: 0,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

const closet = [
  garment("tops", "sweater"),
  garment("bottoms", "jeans"),
  garment("dresses", "dress"),
  garment("outerwear", "jacket"),
  garment("shoes", "boots"),
  garment("underwear", "boxer_briefs"),
  garment("accessories", "watch"),
  garment("accessories", "necklace"),
  garment("accessories", "beanie"),
  garment("accessories", "glasses"),
  garment("bottoms", "skirt"),
];

for (const required of closet.slice(0, 7)) {
  const sagMode = required.category === "underwear";
  const candidates = generateOutfitCandidates(
    closet,
    3,
    [1, 0, 0],
    required,
    [1, 0, 0],
    { sagMode }
  );
  assert.ok(candidates.length > 0, `no candidate for ${required.category}`);
  assert.ok(
    candidates.every((candidate) =>
      candidate.garments.some(({ garment: item }) => item.id === required.id)
    ),
    `required ${required.category} was dropped`
  );
}

for (let run = 0; run < 100; run += 1) {
  const sagCandidates = generateOutfitCandidates(
    closet,
    5,
    [1, 0, 0],
    undefined,
    [1, 0, 0],
    { sagMode: true }
  );
  assert.ok(sagCandidates.length > 0, "Sag mode produced no candidates");

  for (const candidate of sagCandidates) {
    const categories = candidate.garments.map(({ garment: item }) => item.category);
    assert.equal(categories.includes("dresses"), false);
    assert.equal(categories.filter((category) => category === "underwear").length, 1);
    assert.equal(
      candidate.garments.some(({ garment: item }) => item.subtype === "skirt"),
      false
    );

    const accessorySubtypes = candidate.garments
      .filter(({ garment: item }) => item.category === "accessories")
      .map(({ garment: item }) => item.subtype ?? "other");
    assert.equal(
      accessorySubtypes.length,
      new Set(accessorySubtypes).size,
      "duplicate accessory subtype"
    );
  }
}

const skirt = closet.find((item) => item.subtype === "skirt");
assert.equal(
  generateOutfitCandidates(
    closet,
    3,
    [1, 0, 0],
    skirt,
    [1, 0, 0],
    { sagMode: true }
  ).length,
  0,
  "Sag mode should not put underwear under a skirt"
);

console.log("Generator stress checks passed for every category and Sag mode.");
