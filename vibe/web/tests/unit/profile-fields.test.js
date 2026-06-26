import { describe, it, expect } from 'vitest';
import {
  extractExtendedProfileFields,
  buildProfileStatsFromMeta,
  ageYearsFromBirthDate,
  normalizeProfileClaimLanguages,
  profileAboutHtmlWithHashtagLinks,
  extractProfileHashtagSlugsFromMeta,
  firstSeenOnNostrootsTimestamp,
  firstSeenOnNostrootsLine,
  profileHasMeaningfulRelayData,
  classifyNostrootsSetupState,
  mergeProfile30390AndKind0,
  pictureUrlFromTrustrootsUserApiJson,
  isTrustrootsLocalProfileUploadUrl,
} from '../../index.js';

describe('profile claim field normalization', () => {
  it('normalizes extended fields from kind 30390 content', () => {
    const from90 = {
      gender: 'Male',
      birthDate: '1974-03-11',
      memberSince: 1590055200,
      livesIn: { city: 'Pisa', country: 'Italy' },
      from: 'Pisa, Italy',
      languages: 'English, Esperanto;Italian/Spanish',
    };
    const ext = extractExtendedProfileFields(from90, {});
    expect(ext.gender).toBe('male');
    expect(ext.birthDate).toBe('1974-03-11');
    expect(ext.memberSince).toBe(1590055200);
    expect(ext.livesIn).toEqual({ display: 'Pisa, Italy', city: 'Pisa', country: 'Italy' });
    expect(ext.from).toEqual({ display: 'Pisa, Italy' });
    expect(ext.languages).toEqual(['English', 'Esperanto', 'Italian', 'Spanish']);
  });

  it('falls back to kind 0-compatible fields when 30390 omits them', () => {
    const from0 = {
      gender: 'female',
      birthdate: '1980-01-02',
      member_since: 1700000000,
      languages: ['French', 'German'],
    };
    const ext = extractExtendedProfileFields({}, from0);
    expect(ext.gender).toBe('female');
    expect(ext.birthDate).toBe('1980-01-02');
    expect(ext.memberSince).toBe(1700000000);
    expect(ext.languages).toEqual(['French', 'German']);
  });

  it('maps ISO language codes to readable labels', () => {
    const languages = normalizeProfileClaimLanguages(['eng', 'ger', 'deu', 'English', 'iso_639_3-arz']);
    expect(languages).toEqual(['English', 'German', 'Egyptian Arabic']);
  });
});

describe('profile stats projection', () => {
  it('builds public-profile stat lines from normalized metadata', () => {
    const stats = buildProfileStatsFromMeta(
      {
        gender: 'male',
        birthDate: '1974-03-11',
        memberSince: 1590055200,
        livesIn: { display: 'Pisa, Italy' },
        from: { display: 'Pisa, Italy' },
        languages: ['English', 'Esperanto'],
      },
      Date.UTC(2026, 4, 12)
    );
    expect(stats.demographicsLine).toBe('52 years. Male.');
    expect(stats.memberSinceLine).toBe('Trustroots member since 2020-05-21');
    expect(stats.livesInLine).toBe('Lives in Pisa, Italy');
    expect(stats.fromLine).toBe('From Pisa, Italy');
    expect(stats.languages).toEqual(['English', 'Esperanto']);
  });

  it('returns empty lines when fields are absent (hide-if-missing)', () => {
    const stats = buildProfileStatsFromMeta({}, Date.UTC(2026, 4, 12));
    expect(stats.demographicsLine).toBe('');
    expect(stats.memberSinceLine).toBe('');
    expect(stats.livesInLine).toBe('');
    expect(stats.fromLine).toBe('');
    expect(stats.languages).toEqual([]);
  });

  it('computes age from YYYY-MM-DD correctly', () => {
    expect(ageYearsFromBirthDate('2000-05-12', Date.UTC(2026, 4, 12))).toBe(26);
    expect(ageYearsFromBirthDate('2000-05-13', Date.UTC(2026, 4, 12))).toBe(25);
  });

  it('builds first-seen-on-Nostroots stats from the earliest note authored by the profile', () => {
    const subject = 'a'.repeat(64);
    const events = [
      { id: 'profile-event-is-ignored', kind: 0, pubkey: subject, created_at: 946684800 },
      { id: 'repost-is-ignored', kind: 30398, pubkey: subject, created_at: 978307200 },
      { id: 'other-author-is-ignored', kind: 30397, pubkey: 'b'.repeat(64), created_at: 1009843200 },
      { id: 'newer-note', kind: 30397, pubkey: subject, created_at: 1735689600 },
      [{ id: 'oldest-note', kind: 30397, pubkey: subject, created_at: 1704067200 }],
      { id: 'invalid-note', kind: 30397, pubkey: subject, created_at: 0 },
    ];
    expect(firstSeenOnNostrootsTimestamp(events, subject)).toBe(1704067200);
    expect(firstSeenOnNostrootsLine(events, subject)).toBe('First seen on Nostroots 2024-01-01');
  });

  it('treats NIP-05-only profiles as empty relay data', () => {
    expect(profileHasMeaningfulRelayData({
      meta: { nip05: 'alice@trustroots.org', trustrootsUsername: 'alice' },
      notes: [],
      relationships: [],
      experiences: [],
      connectedPeople: [],
      hostEvents: [],
      circleSlugs: [],
    })).toBe(false);
  });

  it('detects profile content, notes, and trust metrics as meaningful relay data', () => {
    expect(profileHasMeaningfulRelayData({ meta: { about: 'hello' } })).toBe(true);
    expect(profileHasMeaningfulRelayData({ notes: [{ id: 'note' }] })).toBe(true);
    expect(profileHasMeaningfulRelayData({ trustMetric: 2 })).toBe(true);
  });
});

describe('profile picture precedence', () => {
  const localUpload =
    'https://www.trustroots.org/uploads-profile/665033c061af073e7e3c628c/avatar/256.jpg?1710000000000';
  const nostrPicture = 'https://cdn.example.net/nostr/avatar.webp';
  const gravatar = 'https://www.gravatar.com/avatar/abc?s=256&d=identicon';

  it('prefers Nostr kind 0 picture over imported Trustroots profile picture', () => {
    const meta = mergeProfile30390AndKind0(
      { content: JSON.stringify({ picture: localUpload, display_name: 'Trustroots Alice' }) },
      { content: JSON.stringify({ picture: nostrPicture, name: 'Nostr Alice' }) }
    );
    expect(meta.picture).toBe(nostrPicture);
  });

  it('ignores stale non-local Trustroots import pictures', () => {
    const meta = mergeProfile30390AndKind0(
      { content: JSON.stringify({ picture: gravatar, display_name: 'Trustroots Alice' }) },
      { content: JSON.stringify({ about: 'No picture here' }) }
    );
    expect(meta.picture).toBe('');
  });

  it('uses Trustroots local uploads as the fallback picture', () => {
    const meta = mergeProfile30390AndKind0(
      { content: JSON.stringify({ picture: localUpload }) },
      { content: JSON.stringify({ about: 'No picture here' }) }
    );
    expect(meta.picture).toBe(localUpload);
  });

  it('returns local-upload Trustroots API avatars and omits Gravatar', () => {
    expect(isTrustrootsLocalProfileUploadUrl(localUpload)).toBe(true);
    expect(
      pictureUrlFromTrustrootsUserApiJson({
        _id: '665033c061af073e7e3c628c',
        avatarSource: 'local',
        avatarUploaded: true,
        updated: '2024-03-09T16:00:00.000Z',
      })
    ).toBe(localUpload);
    expect(pictureUrlFromTrustrootsUserApiJson({
      avatarSource: 'gravatar',
      emailHash: 'abc',
    })).toBe('');
  });
});

describe('setup-state projection', () => {
  it('separates no key, key without Trustroots NIP-05, and ready states', () => {
    expect(classifyNostrootsSetupState({ hasKey: false, hasTrustrootsNip05: false })).toBe('no_key');
    expect(classifyNostrootsSetupState({ hasKey: true, hasTrustrootsNip05: false })).toBe('key_without_trustroots');
    expect(classifyNostrootsSetupState({ hasKey: true, hasTrustrootsNip05: true })).toBe('ready');
  });
});

describe('profile about hashtag rendering', () => {
  it('keeps safe prose HTML, strips URL links, and links only hashtags to chats', () => {
    const html = profileAboutHtmlWithHashtagLinks(
      '<p>Hello #hacker<br><a href="https://example.com">https://example.com</a></p><script>alert(1)</script>'
    );
    const root = document.createElement('div');
    root.innerHTML = html;

    expect(root.querySelector('p')).not.toBeNull();
    expect(root.querySelector('br')).not.toBeNull();
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('https://example.com');

    const links = [...root.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('#hacker');
    expect(links[0].getAttribute('href')).toBe('#hacker');
  });

  it('extracts profile hashtags from HTML text and structured fields', () => {
    expect(
      extractProfileHashtagSlugsFromMeta({
        about: '<p>#hacker and #family at https://example.com/#not-a-tag</p>',
        from90: { interests: ['#musician', 'hitchhiker'] },
      })
    ).toEqual(['hacker', 'family', 'musician', 'hitchhiker']);
  });
});
