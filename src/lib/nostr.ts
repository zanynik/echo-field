import NDK, { NDKEvent, NDKNip07Signer, NDKPrivateKeySigner, NDKFilter, NDKKind } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

// Default relays to connect to
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.mom",
  "wss://nostr.wine"
];

let ndk: NDK;

export const initNDK = async () => {
  if (ndk) return ndk;

  ndk = new NDK({
    explicitRelayUrls: DEFAULT_RELAYS,
  });

  // Try to use NIP-07 signer if available
  if (window.nostr) {
    ndk.signer = new NDKNip07Signer();
  }

  await ndk.connect();
  return ndk;
};

export const getNDK = () => {
  if (!ndk) {
    throw new Error("NDK not initialized. Call initNDK() first.");
  }
  return ndk;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to wait for window.nostr to be injected
const waitForNostr = (retries = 10, interval = 200): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.nostr) {
      return resolve();
    }

    let count = 0;
    const timer = setInterval(() => {
      if (window.nostr) {
        clearInterval(timer);
        resolve();
      } else if (count >= retries) {
        clearInterval(timer);
        resolve();
      }
      count++;
    }, interval);
  });
};

export const loginWithNostr = async () => {
  const ndk = await initNDK();

  // Wait for extension to be ready
  await waitForNostr();

  if (window.nostr) {
    // Always assign the signer here to ensure it's set
    ndk.signer = new NDKNip07Signer();

    // blockUntilReady can hang if extension doesn't respond, adding a race
    await Promise.race([
      ndk.signer.blockUntilReady(),
      wait(2000)
    ]);
    const user = await ndk.signer.user();
    await user.fetchProfile();
    return user;
  } else {
    throw new Error("No NIP-07 extension found");
  }
}

export const loginWithSecretKey = async (key: string) => {
  const ndk = await initNDK();

  let privateKey = key;

  // If it starts with nsec, decode it
  if (key.startsWith('nsec')) {
    try {
      const { data } = nip19.decode(key);
      privateKey = data as string;
    } catch (e) {
      throw new Error("Invalid nsec format");
    }
  }

  try {
    const signer = new NDKPrivateKeySigner(privateKey);
    ndk.signer = signer;

    // Validate by fetching user
    const user = await signer.user();
    await user.fetchProfile();
    return user;
  } catch (e) {
    throw new Error("Invalid private key");
  }
}


export interface NostrPost {
  id: string;
  content: string;
  pubkey: string;
  created_at: number;
  parent_id: string | null; // Derived from tags
  tags: string[][];
  comments?: NostrPost[];
  authorName?: string;
}

export const fetchPosts = async (): Promise<NostrPost[]> => {
  const ndk = await initNDK();

  // Filter for Kind 1 (Text Note) events
  const filter: NDKFilter = {
    kinds: [1],
    limit: 50, // Fetch recent 50 posts
  };

  const events = await ndk.fetchEvents(filter);
  const posts: NostrPost[] = [];

  for (const event of events) {
    posts.push(mapEventToPost(event));
  }

  return posts.sort((a, b) => b.created_at - a.created_at);
};

const mapEventToPost = (event: NDKEvent): NostrPost => {
  const eTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply'); // nip-10 preferred
  const replyTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply');
  const allETags = event.tags.filter(t => t[0] === 'e');
  const lastETag = allETags.length > 0 ? allETags[allETags.length - 1] : undefined;

  // Use reply tag if available, otherwise fallback to last e tag (NIP-10 legacy)
  const parentTag = replyTag || lastETag;

  return {
    id: event.id,
    content: event.content,
    pubkey: event.pubkey,
    created_at: event.created_at || 0,
    parent_id: parentTag ? parentTag[1] : null,
    tags: event.tags,
    comments: []
  }
}

export const publishPost = async (content: string, parentId?: string) => {
  const ndk = getNDK();
  if (!ndk.signer) {
    throw new Error("Not authenticated");
  }

  const event = new NDKEvent(ndk);
  event.kind = 1;
  event.content = content;

  if (parentId) {
    event.tags.push(["e", parentId, "", "reply"]);
  }

  await event.publish();
  return mapEventToPost(event);
}

export const fetchThread = async (rootId: string): Promise<NostrPost[]> => {
  const ndk = await initNDK();

  // 1. Fetch the root event
  const rootEvent = await ndk.fetchEvent(rootId);
  const posts: NostrPost[] = [];

  if (rootEvent) {
    posts.push(mapEventToPost(rootEvent));
  }

  // 2. Fetch direct replies (events tagging this rootId)
  // Note: NIP-10 standardizes 'e' tags. NDK might have helpers but raw filter is safe.
  const filter: NDKFilter = {
    kinds: [1],
    "#e": [rootId],
    limit: 500,
  };

  const events = await ndk.fetchEvents(filter);

  for (const event of events) {
    posts.push(mapEventToPost(event));
  }

  // Sort by created_at ascending so conversation flows naturally in time, 
  // though buildHierarchy will handle tree structure.
  const sortedPosts = posts.sort((a, b) => a.created_at - b.created_at);

  // Batch fetch profiles
  const pubkeys = new Set(sortedPosts.map(p => p.pubkey));
  if (pubkeys.size > 0) {
    const users = await Promise.all(
      Array.from(pubkeys).map(pubkey => ndk.getUser({ hexpubkey: pubkey }).fetchProfile())
    );

    // Create a map of pubkey -> name
    const profileMap = new Map<string, string>();
    Array.from(pubkeys).forEach((pubkey, i) => {
      const profile = users[i];
      if (profile) {
        profileMap.set(pubkey, profile.name || profile.displayName || "");
      }
    });

    // Update posts with author names
    sortedPosts.forEach(post => {
      post.authorName = profileMap.get(post.pubkey);
    });
  }

  return sortedPosts;
};

export const getUserProfile = async (pubkey: string) => {
  const ndk = await initNDK();
  const user = ndk.getUser({ hexpubkey: pubkey });
  await user.fetchProfile();
  return user.profile;
}
