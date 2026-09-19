import type { KnowledgeDescriptor } from '@suhuella/product/types.ts'

/**
 * INTELLIGENCE-MODEL-001 — Local Intelligence
 *
 * Enriches a KnowledgeDescriptor before the Recommendation Engine ranks.
 * Extracts semantic signals locally. No Internet. No cloud. No API calls.
 * No user accounts. No BYOK.
 *
 * The Recommendation Engine consumes the enriched descriptor. It never knows
 * how the signals were produced.
 *
 * BYOK does not live here. BYOK is an optional assistant after recommendation.
 */
export function enrichKnowledgeDescriptor(descriptor: KnowledgeDescriptor): KnowledgeDescriptor {
  return descriptor
}
