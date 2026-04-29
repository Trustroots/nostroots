export function extractRelationshipTargetsFromClaims(claims, currentPublicKey) {
  const targets = new Set();
  if (!Array.isArray(claims) || !currentPublicKey) return targets;
  const current = String(currentPublicKey).toLowerCase();
  for (const claim of claims) {
    const tags = Array.isArray(claim?.tags) ? claim.tags : [];
    const pTags = tags.filter((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
    const first = pTags[0]?.[1] || '';
    const second = pTags[1]?.[1] || '';
    if (String(first).toLowerCase() === current && second) {
      targets.add(second);
    }
  }
  return targets;
}

export function mergePTags(existingTags, targets) {
  const merged = new Set(Array.isArray(targets) ? targets : Array.from(targets || []));
  const tags = Array.isArray(existingTags) ? existingTags : [];
  for (const tag of tags) {
    if (Array.isArray(tag) && tag[0] === 'p' && tag[1]) merged.add(tag[1]);
  }
  return Array.from(merged);
}

export function buildKind3Tags(mergedPubkeys) {
  return (mergedPubkeys || []).map((pubkey) => ['p', pubkey]);
}

export function buildTrustroots30000Tags(mergedPubkeys) {
  return [['d', 'trustroots-contacts'], ...(mergedPubkeys || []).map((pubkey) => ['p', pubkey])];
}
