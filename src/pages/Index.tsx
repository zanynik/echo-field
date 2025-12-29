import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Info, Send, Star, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { fetchPosts, publishPost, loginWithNostr, loginWithSecretKey, NostrPost, fetchThread } from "@/lib/nostr";
import { nip19 } from 'nostr-tools';
import { NDKUser } from "@nostr-dev-kit/ndk";
import NostrVisualization from "@/components/NostrVisualization";
import { useTheme } from "@/hooks/use-theme";


const buildHierarchy = (posts: NostrPost[], highlightedId?: string): NostrPost[] => {
  const postMap = new Map<string, NostrPost>();
  const rootPosts: NostrPost[] = [];

  // First pass: Create map of all posts
  posts.forEach((post) => {
    postMap.set(post.id, { ...post, comments: [] });
  });

  // Second pass: Build hierarchy
  posts.forEach((post) => {
    const postWithComments = postMap.get(post.id)!;
    if (post.parent_id) {
      const parentPost = postMap.get(post.parent_id);
      if (parentPost) {
        parentPost.comments = parentPost.comments || [];
        parentPost.comments.push(postWithComments);
      }
    } else {
      rootPosts.push(postWithComments);
    }
  });

  // If we have a highlighted post, move it to the top
  if (highlightedId) {
    const highlightIndex = rootPosts.findIndex((post) => post.id === highlightedId);
    if (highlightIndex > 0) {
      const [highlightedPost] = rootPosts.splice(highlightIndex, 1);
      rootPosts.unshift(highlightedPost);
    }
  }

  return rootPosts;
};

const Index = () => {
  const [posts, setPosts] = useState<NostrPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<NostrPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isGraphVisible, setIsGraphVisible] = useState(true);
  const { theme } = useTheme();

  // Login related state
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);


  // Helper to find path to a node
  const findPathToNode = (nodes: NostrPost[], targetId: string, currentPath: string[] = []): string[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...currentPath, node.id];
      }
      if (node.comments) {
        const path = findPathToNode(node.comments, targetId, [...currentPath, node.id]);
        if (path) return path;
      }
    }
    return null;
  };

  const onNodeClick = (postId: string) => {
    // 1. Find path and expand parents
    const path = findPathToNode(posts, postId);
    if (path) {
      const newExpanded = new Set(expandedIds);
      path.forEach(id => newExpanded.add(id));
      setExpandedIds(newExpanded);
    }

    // 2. Hide graph (optional based on preference, but user suggested it)
    // setIsGraphVisible(false);

    // 3. Scroll to post
    // Wait for expansion to render
    setTimeout(() => {
      const element = document.getElementById(postId);
      const header = document.querySelector('.sticky-header');
      const headerHeight = header ? header.clientHeight : 0;

      if (element) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20; // 20px buffer

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });

        element.classList.add('highlight-flash');
        setTimeout(() => element.classList.remove('highlight-flash'), 2000);
      }
    }, 300);
  };

  const [user, setUser] = useState<NDKUser | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const loadPosts = async () => {
    try {
      setIsLoading(true);

      const ROOT_NEVENT = "nostr:nevent1qvzqqqqqqypzqeths29gsa2ld5xn5znwjng7zf87vhv6n4qkd09jhsef75uud23jqqszw9l6e2qnx850cdpj7vg4nru48skfypusg0g2pggsm0qyswn7nkgfg8296";
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

      console.log("Fetching thread for root:", rootId);
      const data = await fetchThread(rootId);
      const hierarchicalPosts = buildHierarchy(data || []);
      setPosts(hierarchicalPosts);
      setFilteredPosts(hierarchicalPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
      toast({
        title: "Error",
        description: "Failed to load posts from NOSTR",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      // Try extension first
      const user = await loginWithNostr();
      setUser(user);
      toast({
        title: "Success",
        description: `Logged in as ${user.npub.slice(0, 8)}...`,
      });
    } catch (error: any) {
      console.log("Extension login failed, showing manual login dialog");
      setShowLoginDialog(true);
    }
  }

  const handleManualLogin = async () => {
    if (!secretKeyInput.trim()) return;
    setIsLoggingIn(true);
    try {
      const user = await loginWithSecretKey(secretKeyInput.trim());
      setUser(user);
      setShowLoginDialog(false);
      setSecretKeyInput("");
      toast({
        title: "Success",
        description: `Logged in as ${user.npub.slice(0, 8)}...`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid key",
        variant: "destructive"
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    setIsPublishing(true);
    try {
      await publishPost(newPostContent);
      setNewPostContent("");
      toast({ title: "Posted!", description: "Your note has been published." });
      // Refresh posts after a delay
      setTimeout(loadPosts, 1000);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to publish", variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch(event as any);
    }
  };

  const handleSearch = (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
      return;
    }

    // Find the first matching post that contains the search term
    const matchingPost = posts.find(post =>
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchingPost) {
      const hierarchicalPost = buildHierarchy([matchingPost]);
      setFilteredPosts(hierarchicalPost);
    } else {
      setFilteredPosts([]);
    }
  };

  const toggleCommentVisibility = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="container py-8 space-y-8">

        <div className="sticky-header sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 border-b mb-8 -mx-4 px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="w-1/4">
              <ThemeToggle />
            </div>
            <div className="flex gap-4 items-center justify-center w-1/2">
              <Button variant="ghost" onClick={() => setIsGraphVisible(!isGraphVisible)}>
                <Star className={`h-4 w-4 ${isGraphVisible ? "fill-current" : ""}`} />
              </Button>
              {!user ? (
                <Button onClick={handleLogin} variant="outline" className="ml-2">
                  Login with NOSTR
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{user.profile?.name || user.profile?.displayName || user.npub.slice(0, 8) + "..."}</span>
                </div>
              )}
            </div>
            <div className="w-1/4 flex justify-end">
              <a
                href="https://github.com/zanynik/echo-field"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <Button variant="ghost" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          {isGraphVisible && (
            <div className="transition-all duration-500 ease-in-out">
              <NostrVisualization posts={filteredPosts.length > 0 ? filteredPosts : posts} theme={theme} onNodeClick={onNodeClick} />
            </div>
          )}
        </div>

        {/* Login Modal */}
        {showLoginDialog && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Login to Nostr</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowLoginDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your private key (starts with nsec...) to login. Your key is only used locally to sign events.
              </p>
              <div className="space-y-4">
                <Input
                  type="password"
                  placeholder="nsec1..."
                  value={secretKeyInput}
                  onChange={(e) => setSecretKeyInput(e.target.value)}
                />
                <Button className="w-full" onClick={handleManualLogin} disabled={isLoggingIn}>
                  {isLoggingIn ? "Verifying..." : "Login"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Posts Section */}

        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center">...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center">X</div>
          ) : (
            filteredPosts.map((post, index) => (
              <Post
                key={post.id}
                id={post.id}
                content={post.content}
                comments={post.comments || []}
                onUpdate={loadPosts}
                isLast={index === 0}
                expandedIds={expandedIds}
                theme={theme}
              />
            ))
          )}
        </div>
      </div>
    </div>

  );
};

export default Index;