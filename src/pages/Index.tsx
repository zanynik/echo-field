import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkle, Info, Globe, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import Groq from "groq-sdk";
import { fetchPosts, publishPost, loginWithNostr, NostrPost } from "@/lib/nostr";
import { NDKUser } from "@nostr-dev-kit/ndk";
import NostrVisualization from "@/components/NostrVisualization";
import { useTheme } from "@/hooks/use-theme";

// Initialize Groq only if key is present, or handle it gracefully
const getGroqClient = () => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.warn("VITE_GROQ_API_KEY is missing. AI features will not work.");
    return null;
  }
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
};

// Using NostrPost as the type
// But for compatibility with existing strict logic in buildHierarchy, let's keep a flexible type or just use NostrPost everywhere
// buildHierarchy expects comments array to be mutable/present.


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
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiChatInput, setAiChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isGraphVisible, setIsGraphVisible] = useState(true);
  const { theme } = useTheme();

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
    setIsGraphVisible(false);

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
      const data = await fetchPosts();
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
      const user = await loginWithNostr();
      setUser(user);
      toast({
        title: "Success",
        description: `Logged in as ${user.npub.slice(0, 8)}...`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to login with extension",
        variant: "destructive"
      });
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

  const handleAIClick = async () => {
    setAiChatVisible(true);

    if (!searchQuery.trim()) {
      // Welcome message with project info
      const welcomeMessage = `
        🌌 Echo Field is an experimental social space that intentionally strips away traditional social media elements like usernames, likes, counts of comments and timestamps, focusing purely on the content and its position in the conversation tree. 
        You can ask AI about the conversations/posts here - Chat with the Echoes!
      `;
      setChatHistory([{ role: "assistant", content: welcomeMessage }]);
      return;
    }

    try {
      // Add user's message to chat history
      setChatHistory((prev) => [...prev, { role: "user", content: searchQuery }]);

      // Check if the query is related to posts
      if (searchQuery.toLowerCase().includes("post") || searchQuery.toLowerCase().includes("conversation") || searchQuery.toLowerCase().includes("echo")) {
        // Fetch posts from NOSTR via NDK
        const posts = await fetchPosts(); // This gets recent 50

        // Format posts for the AI
        const postsContent = posts
          .map((post) => `- ${post.content}`)
          .join("\n");

        // Create a prompt for the AI
        const prompt = `
          The user asked: "${searchQuery}".
          Here are some recent posts from Echo Field (NOSTR):
          ${postsContent}
  
          Forming sentence chains by joining "id" to their "parent_id" can make more sense sometimes then individual content. Please provide a response based on the user's question and the posts above.
        `;

        // Get AI response
        const groq = getGroqClient();
        if (!groq) {
          toast({ title: "Error", description: "AI not configured (missing API key)", variant: "destructive" });
          return;
        }
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "llama-3.3-70b-versatile",
        });

        // Add AI's response to chat history
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" },
        ]);
      } else {
        // Handle general questions
        const groq = getGroqClient();
        if (!groq) {
          toast({ title: "Error", description: "AI not configured (missing API key)", variant: "destructive" });
          return;
        }
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: searchQuery,
            },
          ],
          model: "llama-3.3-70b-versatile",
        });

        // Add AI's response to chat history
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" },
        ]);
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      toast({
        title: "Error",
        description: "Failed to fetch AI response",
        variant: "destructive",
      });
    }
  };

  const handleAIChatInput = async (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    if (!aiChatInput.trim()) {
      return;
    }

    try {
      // Add user's message to chat history
      setChatHistory((prev) => [...prev, { role: "user", content: aiChatInput }]);

      // Check if the query is related to posts
      if (aiChatInput.toLowerCase().includes("posts") || aiChatInput.toLowerCase().includes("conversations")) {
        // Fetch posts from NOSTR
        const posts = await fetchPosts();

        // Format posts for the AI
        const postsContent = posts
          .map((post) => `- ${post.content}`)
          .join("\n");

        // Create a prompt for the AI
        const prompt = `
          The user asked: "${aiChatInput}".
          Here are some recent posts from Echo Field (NOSTR):
          ${postsContent}
  
          Please provide a response based on the user's question and the posts above.
        `;

        // Get AI response
        const groq = getGroqClient();
        if (!groq) {
          toast({ title: "Error", description: "AI not configured (missing API key)", variant: "destructive" });
          return;
        }
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "llama-3.3-70b-versatile",
        });

        // Add AI's response to chat history
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" },
        ]);
      } else {
        // Handle general questions
        const groq = getGroqClient();
        if (!groq) {
          toast({ title: "Error", description: "AI not configured (missing API key)", variant: "destructive" });
          return;
        }
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: aiChatInput,
            },
          ],
          model: "llama-3.3-70b-versatile",
        });

        // Add AI's response to chat history
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" },
        ]);
      }

      setAiChatInput("");
    } catch (error) {
      console.error("Error fetching AI response:", error);
      toast({
        title: "Error",
        description: "Failed to fetch AI response",
        variant: "destructive",
      });
    }
  };

  const toggleCommentVisibility = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-8">

        <div className="sticky-header sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 border-b mb-8 -mx-4 px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="w-1/4">
              <ThemeToggle />
            </div>
            <div className="flex gap-2 items-center justify-center w-1/2">
              <Button variant={isGraphVisible ? "default" : "outline"} onClick={() => setIsGraphVisible(!isGraphVisible)} size="sm">
                {isGraphVisible ? "Hide Graph" : "Show Graph"}
              </Button>
              <Button variant="ghost" onClick={handleAIClick}>
                <Sparkle className="h-4 w-4" />
              </Button>
              {!user ? (
                <Button onClick={handleLogin} variant="outline" className="ml-2">
                  Login with NOSTR
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden md:inline">{user.profile?.name || user.npub.slice(0, 8)}...</span>
                </div>
              )}
            </div>
            <div className="w-1/4 flex justify-end">
              <a
                href="https://zanynik.github.io/echo-field/"
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

        {/* AI Chat Section */}
        {aiChatVisible && (
          <div className="bg-background border rounded-lg shadow-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sparkle className="h-5 w-5" />
              </div>
              <button
                onClick={() => setAiChatVisible(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto max-h-96 mb-4 pr-2">
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`mb-4 ${message.role === "user" ? "flex justify-end" : ""
                    }`}
                >
                  {message.role === "user" ? (
                    // User message in a bubble
                    <div className="max-w-[80%] p-3 rounded-lg bg-blue-100 text-blue-900">
                      <p>{message.content}</p>
                    </div>
                  ) : (
                    // AI message in full width (same style as posts)
                    <div className="w-full">
                      <div className="text-gray-900 whitespace-pre-wrap">
                        {message.content.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAIChatInput(e);
                  }
                }}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button onClick={handleAIChatInput}>
                <Sparkle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Posts Section */}
        {user && (
          <div className="bg-card border rounded-lg p-4 shadow-sm mb-6">
            <div className="flex gap-2">
              <Input
                placeholder="What's on your mind? (Public NOSTR Note)"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePost()}
              />
              <Button onClick={handleCreatePost} disabled={isPublishing}>
                {isPublishing ? '...' : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
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
                onUpdate={loadPosts}
                isLast={index === 0}
                expandedIds={expandedIds}
              />
            ))
          )}
        </div>
      </div>
    </div>

  );
};

export default Index;