import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_V4_RANGES = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.0.255'],
  ['192.0.2.0', '192.0.2.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['198.51.100.0', '198.51.100.255'],
  ['203.0.113.0', '203.0.113.255'],
];

const PRIVATE_V6_PREFIXES = [
  '::1',
  'fc',
  'fd',
  'fe80',
  '2001:db8',
];

const isControlUnsafe = (value) => /[\x00-\x1F\x7F]/.test(String(value || ''));

const startsWithAny = (value, prefixes) => prefixes.some((prefix) => value === prefix || value.startsWith(prefix));

const ipv4ToInt = (address) => {
  const parts = String(address).split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
};

const isPrivateIpv4 = (address) => {
  const value = ipv4ToInt(address);
  if (value === null) return true;
  return PRIVATE_V4_RANGES.some(([start, end]) => {
    const lower = ipv4ToInt(start);
    const upper = ipv4ToInt(end);
    return value >= lower && value <= upper;
  });
};

const isPrivateIpv6 = (address) => startsWithAny(String(address).toLowerCase(), PRIVATE_V6_PREFIXES);

export const isPublicIpAddress = (address) => {
  if (isIP(address) === 4) return !isPrivateIpv4(address);
  if (isIP(address) === 6) return !isPrivateIpv6(address);
  return false;
};

export const isProbablyPublicHost = (hostname) => {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return false;
  if (isControlUnsafe(host)) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.lan')) return false;
  if (host === 'metadata.google.internal') return false;
  if (host === 'host.docker.internal') return false;
  if (isIP(host)) return isPublicIpAddress(host);
  return true;
};

const assertSafeParsedUrl = async (url) => {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('only http and https urls are allowed');
  }
  if (url.username || url.password) {
    throw new Error('credentials in url are not allowed');
  }
  if (!isProbablyPublicHost(url.hostname)) {
    throw new Error('private or local hosts are not allowed');
  }

  const literal = isIP(url.hostname);
  if (literal && !isPublicIpAddress(url.hostname)) {
    throw new Error('private ip addresses are not allowed');
  }

  if (!literal) {
    const records = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => null);
    if (!Array.isArray(records) || !records.length) {
      throw new Error('hostname resolution failed');
    }
    if (!records.every((record) => isPublicIpAddress(record.address))) {
      throw new Error('resolved to a private address');
    }
  }

  return url;
};

export const assertSafeHttpUrl = async (value) => {
  const text = String(value || '').trim();
  if (!text) throw new Error('url required');

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('invalid url');
  }

  if (isControlUnsafe(text)) {
    throw new Error('url contains invalid control characters');
  }

  return assertSafeParsedUrl(url);
};

export const resolveRedirectTarget = async (currentUrl, location) => {
  const next = new URL(String(location || ''), currentUrl);
  return assertSafeParsedUrl(next);
};