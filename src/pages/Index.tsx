import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bot, Info, Globe } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import SphereVisualization from "@/components/SphereVisualization";

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

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

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

  const handleAIClick = () => {
    toast({
      title: "AI Assistant",
      description: "AI functionality coming soon!",
    });
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
              <Bot className="h-4 w-4" />
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