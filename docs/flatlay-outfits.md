# Flat-lay outfits

## Garment taxonomy

Migration `007_flatlay_outfit_taxonomy.sql` adds `underwear` as a garment
category plus two structured fields:

- `subtype` identifies silhouettes and accessory roles. Underwear supports
  boxers, briefs, and boxer briefs. Accessories support necklaces, watches,
  hats/beanies, belts, bags, glasses, bracelets, rings, and earbuds.
- `metal_tone` is `none`, `silver`, `gold`, `rose_gold`, or `mixed`.

Existing garments remain valid with a nullable subtype and `none` metal tone.
Both fields can be corrected in the garment metadata editor.

## Sag mode

Sag mode is an explicit user setting on the Home recommendation feed and the
three-look item styling screen. When on, pants outfits require one ready
underwear item and render its waistband behind the bottoms. It never adds
underwear to dress looks. When off, underwear is not included automatically.

Outfits can include several accessories, but only one per subtype, so an
editorial layout can contain a watch, necklace, glasses, and beanie without
duplicating roles.

## Deterministic rendering

`FlatLayCollage` uses the user's existing cutout URLs. Stable slot- and
subtype-aware absolute-position templates arrange dominant clothing, shoes,
underwear, and accessories on a complementary soft canvas. Images use
`contain`, remain tappable, and are never cropped.

No image-generation model or model training is needed. Garment analysis still
extracts searchable metadata and embeddings, while layout is deterministic
React Native UI. This keeps the output faithful to the user's exact clothes,
fast, reproducible, and free of generated-garment hallucinations.

## Deployment

Apply the new schema and redeploy the updated processor:

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy process-garment
```
