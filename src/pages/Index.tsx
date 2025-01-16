import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkle, Info, Globe } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import SphereVisualization from "@/components/SphereVisualization";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface PostType {
  id: string;
  content: string;
  parent_id: string | null;
  comments?: PostType[];
}

const buildHierarchy = (posts: PostType[], highlightedId?: string): PostType[] => {
  const postMap = new Map<string, PostType>();
  const rootPosts: PostType[] = [];

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
  const [posts, setPosts] = useState<PostType[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<PostType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiChatInput, setAiChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      const hierarchicalPosts = buildHierarchy(data || []);
      setPosts(hierarchicalPosts);
      setFilteredPosts(hierarchicalPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch(event);
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
      setChatHistory([{ role: "assistant", content: "Welcome! This is a project where you can explore and ask questions. Feel free to ask anything!" }]);
      return;
    }

    try {
      // Add user's message to chat history
      setChatHistory((prev) => [...prev, { role: "user", content: searchQuery }]);

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
      setChatHistory((prev) => [...prev, { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" }]);
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
      setChatHistory((prev) => [...prev, { role: "assistant", content: chatCompletion.choices[0]?.message?.content || "" }]);
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
        <div className="flex justify-between items-center mb-8">
          <div className="w-1/4">
            <ThemeToggle />
          </div>
          <div className="flex gap-2 items-center w-1/2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full"
            />
            <Button variant="ghost" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={handleAIClick}>
              <Sparkle className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-1/4 flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <Globe className="h-5 w-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px]">
                <SphereVisualization />
              </DialogContent>
            </Dialog>
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

        {/* AI Chat Section */}
        {aiChatVisible && (
          <div className="bg-background border rounded-lg shadow-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">AI Chat</h2>
              <button
                onClick={() => setAiChatVisible(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto max-h-96 mb-4">
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`mb-3 ${
                    message.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`inline-block p-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-blue-100 text-blue-900"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {message.content}
                  </div>
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
                showComments={expandedComments[post.id] || false}
                onToggleComments={() => toggleCommentVisibility(post.id)}
                isLast={index === 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;