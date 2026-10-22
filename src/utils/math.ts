export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

export function weightedAverageVectors(
  vectors: number[][],
  weights: number[]
): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  let totalWeight = 0;

  for (let j = 0; j < vectors.length; j++) {
    const w = weights[j];
    totalWeight += Math.abs(w);
    for (let i = 0; i < dim; i++) {
      result[i] += vectors[j][i] * w;
    }
  }

  if (totalWeight === 0) return result;
  for (let i = 0; i < dim; i++) {
    result[i] /= totalWeight;
  }

  return result;
}
