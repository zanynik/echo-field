
import NDK, { type NDKFilter } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.snort.social",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://nostr.mom",
    "wss://nostr.wine"
];

const ROOT_NEVENT = "nostr:nevent1qvzqqqqqqypzqeths29gsa2ld5xn5znwjng7zf87vhv6n4qkd09jhsef75uud23jqqszw9l6e2qnx850cdpj7vg4nru48skfypusg0g2pggsm0qyswn7nkgfg8296";

async function main() {
    const ndk = new NDK({
        explicitRelayUrls: DEFAULT_RELAYS,
    });

    await ndk.connect();

    let rootId = "";
    try {
        const { type, data } = nip19.decode(ROOT_NEVENT.replace("nostr:", ""));
        if (type === 'nevent') {
            rootId = (data as { id: string }).id;
        } else {
            console.error("Invalid nevent");
            return;
        }
    } catch (e) {
        console.error("Failed to decode nevent", e);
        return;
    }

    // 1. Fetch direct replies to Root
    const filter: NDKFilter = {
        kinds: [1],
        "#e": [rootId],
        limit: 500,
    };
    const events = await ndk.fetchEvents(filter);
    console.log(`Found ${events.size} direct replies to Root.`);

    const sortedEvents = Array.from(events).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

    // 2. Fetch replies to those replies (Level 2)
    const replyIds = sortedEvents.map(e => e.id);
    if (replyIds.length > 0) {
        const recursiveFilter: NDKFilter = {
            kinds: [1],
            "#e": replyIds,
            limit: 500,
        };
        const recursiveEvents = await ndk.fetchEvents(recursiveFilter);
        console.log(`Found ${recursiveEvents.size} secondary replies (Level 2).`);

        // Print tags of secondary replies to see how they reference parents
        recursiveEvents.forEach(e => {
            // Only interested in ones that are NOT in the first set (though strictly they might overlap if they tag both)
            // But usually a Level 2 reply is NOT a direct reply to root in the sense of Thread (it tags root as root, but reply as reply)
            // Wait, if it tags root, the first filter finds it too?
            // YES. The first filter finds anything that tags the root.
            // So Level 2 posts ARE in `events` if they tag the root.

            console.log(`\nEvent: ${e.id}`);
            console.log(`Content: ${e.content}`);
            console.log(`Tags:`, e.tags);
        });
    }

    process.exit(0);
}

main().catch(console.error);
