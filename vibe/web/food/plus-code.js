const ALPHABET = '23456789CFGHJMPQRVWX';
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125];
const VALID_LENGTHS = new Set([2, 4, 6, 8, 10]);

function normalizeLongitude(value) {
  let longitude = Number(value);
  while (longitude < -180) longitude += 360;
  while (longitude >= 180) longitude -= 360;
  return longitude;
}

export function normalizePlusCode(value) {
  return String(value || '').trim().replace(/\s/g, '').toUpperCase();
}

export function encodePlusCode(latitudeValue, longitudeValue, codeLength = 10) {
  let latitude = Number(latitudeValue);
  const longitude = normalizeLongitude(longitudeValue);
  const length = Number(codeLength);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !VALID_LENGTHS.has(length)) return '';
  if (latitude < -90 || latitude > 90) return '';
  if (latitude === 90) latitude -= Number.EPSILON * 90;

  let lat = latitude + 90;
  let lng = longitude + 180;
  let code = '';

  for (let pair = 0; pair < length / 2; pair += 1) {
    const resolution = PAIR_RESOLUTIONS[pair];
    const latDigit = Math.min(ALPHABET.length - 1, Math.floor(lat / resolution));
    const lngDigit = Math.min(ALPHABET.length - 1, Math.floor(lng / resolution));
    code += ALPHABET[latDigit] + ALPHABET[lngDigit];
    lat -= latDigit * resolution;
    lng -= lngDigit * resolution;
  }

  if (code.length < 8) code = code.padEnd(8, '0');
  return code.slice(0, 8) + '+' + code.slice(8);
}

export function decodePlusCodeArea(value) {
  const code = normalizePlusCode(value);
  if (!/^[23456789CFGHJMPQRVWX0]{8}\+(?:[23456789CFGHJMPQRVWX]{2})?$/.test(code)) return null;

  const clean = code.replace('+', '');
  const zeroIndex = clean.indexOf('0');
  const significant = zeroIndex === -1 ? clean : clean.slice(0, zeroIndex);
  if (!VALID_LENGTHS.has(significant.length)) return null;
  if (zeroIndex !== -1 && !/^0+$/.test(clean.slice(zeroIndex))) return null;

  let south = -90;
  let west = -180;
  let resolution = PAIR_RESOLUTIONS[0];

  for (let pair = 0; pair < significant.length / 2; pair += 1) {
    resolution = PAIR_RESOLUTIONS[pair];
    const latDigit = ALPHABET.indexOf(significant[pair * 2]);
    const lngDigit = ALPHABET.indexOf(significant[pair * 2 + 1]);
    if (latDigit < 0 || lngDigit < 0) return null;
    south += latDigit * resolution;
    west += lngDigit * resolution;
  }

  const north = Math.min(90, south + resolution);
  const east = Math.min(180, west + resolution);
  return {
    south,
    west,
    north,
    east,
    centerLat: south + (north - south) / 2,
    centerLng: west + (east - west) / 2,
    length: significant.length,
  };
}

export function isPinInsidePlusCode(value, latitudeValue, longitudeValue) {
  const area = decodePlusCodeArea(value);
  const latitude = Number(latitudeValue);
  const longitude = normalizeLongitude(longitudeValue);
  if (!area || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude >= area.south && latitude <= area.north && longitude >= area.west && longitude <= area.east;
}

export function plusCodePrecisionLabel(length) {
  if (Number(length) <= 6) return 'Broad area';
  if (Number(length) === 8) return 'Neighborhood';
  return 'Precise area';
}
