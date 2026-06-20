// In-memory cache for songs sourced from user-supplied Spotify playlists.
// Playlist songs are not part of the static corpus.json, so the mangle and
// reveal routes fall back to this cache when a song ID is not found in the
// corpus. Entries share the same shape as corpus entries (including hook_lines,
// which must stay server-side until reveal).
//
// The Map is pinned to globalThis because Next.js bundles each route handler
// separately — a plain module-level Map would give each route its own instance,
// so the playlist route's cache would be invisible to the mangle/reveal routes.
// globalThis is shared across all route bundles within the same server process.
//
// NOTE: this only shares state within a single process. On multi-instance or
// serverless deployments (e.g. Vercel), a request to /reveal may land on a
// different instance than the /spotify/playlist call that populated the cache.
// For those environments this should be backed by a shared store (KV/Redis) or
// the hook_lines re-fetched on demand.

const playlistSongs = globalThis.__playlistSongs ?? (globalThis.__playlistSongs = new Map())

export function cachePlaylistSongs(songs = []) {
  for (const song of songs) {
    if (song?.id) playlistSongs.set(song.id, song)
  }
}

export function getPlaylistSong(id) {
  return playlistSongs.get(id) ?? null
}
