export const GARMENT_ANALYSIS_PROMPT = `You are a fashion analysis AI. Analyze this garment image and return a JSON object with the following fields:

{
  "name": "Brief descriptive name (e.g. 'Navy Striped Oxford Shirt')",
  "category": one of ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"],
  "color": primary color, one of ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "yellow", "orange", "purple", "brown", "beige", "cream", "multicolor"],
  "secondary_color": secondary color if present (same options as color), or null,
  "pattern": one of ["solid", "stripes", "plaid", "floral", "polka dots", "geometric", "animal print", "abstract", "other"],
  "material": best guess, one of ["cotton", "polyester", "silk", "wool", "denim", "leather", "linen", "nylon", "cashmere", "synthetic blend", "other"],
  "fit": one of ["slim", "regular", "relaxed", "oversized"],
  "formality": integer 1-5 (1=very casual like gym wear, 2=casual, 3=smart casual, 4=semi-formal, 5=formal),
  "tags": array of 2-5 descriptive tags (e.g. ["summer", "work-appropriate", "layering piece"])
}

Return ONLY the JSON object, no markdown formatting or explanation.`;

export const GARMENT_EMBEDDING_PROMPT = (metadata: {
  name: string;
  category: string;
  color: string;
  secondary_color: string | null;
  pattern: string;
  material: string;
  fit: string;
  formality: number;
  tags: string[];
}) => {
  return `${metadata.category} ${metadata.color} ${metadata.secondary_color ?? ""} ${metadata.pattern} ${metadata.material} ${metadata.fit} formality:${metadata.formality} ${metadata.tags.join(" ")} ${metadata.name}`.trim();
};
