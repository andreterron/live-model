export function getLiveModelWebSocketUrl(
  location?: Pick<Location, 'href'>
): string | URL {
  if (!location) {
    return 'ws://127.0.0.1:3001/live-model';
  }

  const url = new URL('/live-model', location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}
