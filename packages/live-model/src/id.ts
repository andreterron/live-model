// TODO: A "Live" may be identified by a specific ID pattern. A GitHub repo for
//       example don't have to exist within the LiveModel space to be
//       referenceable by "https://github.com/andreterron/live-model" or similar.
//       Look into semantic web.
// TODO: Improve id
export function genId() {
  return (
    Math.random().toString(36).substring(2, 9) +
    Math.random().toString(36).substring(2, 9)
  );
}
