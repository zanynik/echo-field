import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { MessageCircle, Send, Pencil } from "lucide-react";
import { publishPost, NostrPost, getUserProfile } from "@/lib/nostr";
import { nip19 } from "nostr-tools";

// using NostrPost from lib instead of local interface if possible, or mapping
// For now, let's keep the prop interface simple but compatible
interface PostProps {
  id: string;
  content: string;
  tags?: string[][]; // Add tags to props
  comments?: NostrPost[];
  onUpdate: () => void;
  depth?: number;
  isLast?: boolean;
  initialShowComments?: boolean;

  expandedIds?: Set<string>;
  theme?: "light" | "dark" | "system";
}



// Improved component using granular sub-components for mentions? 
// No, let's stick to the simpler one above but fix the async loop issue.
// Actually, `await getUserProfile` inside the loop will be slow.
// Better: Regex replace to components. Components handle their own fetching.

const UserMention = ({ pubkey, fallback }: { pubkey: string, fallback: string }) => {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    getUserProfile(pubkey).then(p => {
      if (p?.name || p?.displayName) setName(p.name || p.displayName);
    }).catch(() => { });
  }, [pubkey]);

  return <span className="text-primary font-medium hover:underline cursor-pointer" title={pubkey}>@{name || fallback}</span>;
}

const ContentRenderer = ({ content, tags }: { content: string, tags: string[][] }) => {
  // Split by regex first (synchronous)
  // Regex: nostr:(npub1...|nprofile1...)|#\[(\d+)\]
  const regex = /nostr:(npub1[a-z0-9]+|nprofile1[a-z0-9]+)|#\[(\d+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const nip19String = match[1]; // npub1...
    const tagIndex = match[2]; // 0, 1... for #[0]

    let element = <span key={match.index}>{fullMatch}</span>;

    if (tagIndex) {
      const idx = parseInt(tagIndex);
      if (tags && tags[idx] && tags[idx][0] === 'p') {
        const pubkey = tags[idx][1];
        element = <UserMention key={match.index} pubkey={pubkey} fallback={pubkey.slice(0, 8) + "..."} />;
      }
    } else if (nip19String) {
      try {
        const decoded = nip19.decode(nip19String);
        let pubkey = "";
        if (decoded.type === 'npub') {
          pubkey = decoded.data as unknown as string;
        }
        if (decoded.type === 'nprofile') {
          pubkey = (decoded.data as any).pubkey;
        }

        if (pubkey) {
          element = <UserMention key={match.index} pubkey={pubkey} fallback={pubkey.slice(0, 8) + "..."} />;
        }
      } catch { }
    }

    parts.push(element);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}


export const Post = ({
  id,
  content,
  tags = [],
  comments = [],
  onUpdate,
  depth = 0,
  isLast = false,
  initialShowComments = false,
  expandedIds,
  theme, // Add theme here
  authorName, // Add authorName prop
}: PostProps & { authorName?: string }) => {
  const [newComment, setNewComment] = useState("");
  const [showWriteComment, setShowWriteComment] = useState(false);
  const [showComments, setShowComments] = useState(initialShowComments);
  const { toast } = useToast();
  // const { theme } = useTheme(); // Use prop instead

  // Check if this post should be expanded based on expandedIds context
  if (expandedIds?.has(id) && !showComments) {
    setShowComments(true);
  }

  const handleContentClick = () => {
    if (comments.length > 0) {
      setShowComments((prev) => !prev); // Toggle only the immediate children
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      await publishPost(newComment, id); // id is the parent_id here

      setNewComment("");
      setShowWriteComment(false);
      setShowComments(true);

      // Small delay to allow relay propagation before refresh, though optimistic would be better
      setTimeout(() => {
        onUpdate();
      }, 1000);

      toast({
        title: "Success",
        description: "Comment published to NOSTR network",
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to publish comment. Make sure you are logged in.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const themeBasedClass = isLast
    ? theme === "dark"
      ? "bg-white/90 text-black"
      : "bg-black/90 text-white"
    : "";

  // Logic for icon colors:
  // If highlighted (isLast):
  //   - Dark Theme: bg is white -> icon black
  //   - Light Theme: bg is black -> icon white
  // If normal:
  //   - Dark Theme: bg is dark -> icon white
  //   - Light Theme: bg is white -> icon black

  const iconColor = theme === "dark"
    ? (isLast ? "black" : "white")
    : (isLast ? "white" : "black");

  const oppositeColor = iconColor; // Active state fill should match the icon stroke color

  const inputTextColor = isLast
    ? theme === "dark"
      ? "text-black placeholder:text-black/60"
      : "text-black placeholder:text-black/60"
    : "text-foreground placeholder:text-muted-foreground";

  return (
    <Card id={id} className={`w-full ${depth > 0 ? "ml-4" : ""} ${themeBasedClass}`}>
      <CardContent
        className={`pt-6 ${comments.length > 0 ? "cursor-pointer" : ""}`}
        onClick={handleContentClick}
      >
        {authorName && (
          <div className="mb-2 text-sm font-semibold opacity-70">
            {authorName}
          </div>
        )}
        <ContentRenderer content={content} tags={tags} />
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="w-full space-y-4">
          <div className="flex gap-2">
            {comments.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1 hover:bg-transparent group"
                onClick={handleContentClick}
              >
                <MessageCircle
                  className="transition-all duration-200"
                  fill={showComments ? oppositeColor : "transparent"}
                  color={iconColor}
                />
              </Button>
            )}
            <Button
              variant="ghost"
              className="flex-1 hover:bg-transparent group"
              onClick={() => setShowWriteComment(!showWriteComment)}
            >
              <Pencil
                className="transition-all duration-200"
                fill={showWriteComment ? oppositeColor : "transparent"}
                color={iconColor}
              />
            </Button>
          </div>

          {showWriteComment && (
            <div className="space-y-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className={`resize-none ${inputTextColor}`}
              />
              <Button
                onClick={handleAddComment}
                className="w-full hover:bg-transparent"
                variant="outline"
              >
                <Send
                  color={iconColor}
                />
              </Button>
            </div>
          )}
        </div>

        {showComments && comments.length > 0 && (
          <div className="w-full space-y-4">
            {comments.map((comment) => (
              <Post
                key={comment.id}
                id={comment.id}
                content={comment.content}
                tags={comment.tags}
                comments={comment.comments}
                onUpdate={onUpdate}
                depth={depth + 1}
                initialShowComments={false}
                expandedIds={expandedIds}
                theme={theme}
                authorName={comment.authorName}
              />
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};