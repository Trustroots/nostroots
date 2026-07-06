// Curated station catalog for Radiostr (subset of radio-guaka channels.js).
const channels = {
  groovesalad: { tags: ['soma', 'indie'] },
  defcon: { tags: ['soma'] },
  dronezone: { tags: ['soma'] },
  lush: { tags: ['soma', 'female'] },
  secretagent: { tags: ['soma'] },
  suburbsofgoa: { tags: ['soma', 'world'] },
  paradise: {
    url: 'https://stream.radioparadise.com/aac-128',
    tags: ['paradise', 'US', 'rock', 'eclectic'],
    site: 'https://www.radioparadise.com/'
  },
  paradise_mellow: {
    url: 'https://stream.radioparadise.com/mellow-128',
    tags: ['paradise', 'US', 'mellow', 'acoustic'],
    site: 'https://www.radioparadise.com/'
  },
  fip: {
    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'eclectic'],
    site: 'https://www.radiofrance.fr/fip'
  },
  antena1: {
    url: 'https://radiocast.rtp.pt/antena180a.mp3',
    tags: ['portugal', 'pt', 'public', 'news', 'variety'],
    site: 'https://www.rtp.pt/play/direto/antena1'
  }
};

const sections = [
  { name: 'SomaFM', tags: ['soma'], order: 1 },
  { name: 'Radio Paradise', tags: ['paradise'], order: 2 },
  { name: 'FIP', tags: ['fip'], order: 3 },
  { name: 'Portugal', tags: ['portugal'], order: 4 }
];

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function deriveChannelImageUrl(id, info) {
  const tags = Array.isArray(info.tags) ? info.tags : [];
  if (tags.includes('soma')) {
    return null;
  }
  if (info.site) {
    const host = hostFromUrl(info.site);
    if (host) return 'https://logo.clearbit.com/' + encodeURIComponent(host);
  }
  if (info.url) {
    const host = hostFromUrl(info.url);
    if (host) return 'https://logo.clearbit.com/' + encodeURIComponent(host);
  }
  return 'https://api.dicebear.com/9.x/shapes/svg?seed=' + encodeURIComponent(id);
}

Object.entries(channels).forEach(([id, info]) => {
  if (!info || typeof info !== 'object' || info.img) return;
  const derived = deriveChannelImageUrl(id, info);
  if (derived) info.img = derived;
});

(function hydrateSomaFmArtwork() {
  if (typeof fetch === 'undefined') return;
  fetch('https://api.somafm.com/channels.json')
    .then((res) => {
      if (!res.ok) throw new Error('soma channels');
      return res.json();
    })
    .then((data) => {
      const list = data && Array.isArray(data.channels) ? data.channels : [];
      const byId = Object.create(null);
      list.forEach((ch) => {
        if (!ch || !ch.id) return;
        const u = ch.largeimage || ch.image;
        if (u && String(u).trim()) byId[ch.id] = String(u).trim();
      });
      let any = false;
      Object.entries(channels).forEach(([id, info]) => {
        if (!info || typeof info !== 'object') return;
        const tags = Array.isArray(info.tags) ? info.tags : [];
        if (!tags.includes('soma')) return;
        const u = byId[id];
        if (u) {
          info.img = u;
          any = true;
        }
      });
      if (any && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('radiostr-somafm-artwork'));
      }
    })
    .catch(() => {});
})();
