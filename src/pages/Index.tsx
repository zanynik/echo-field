import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bot } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface PostType {
  id: string;
  content: string;
  parent_id: string | null;
  comments?: PostType[];
}

const buildHierarchy = (posts: PostType[]): PostType[] => {
  const postMap = new Map<string, PostType>();
  const rootPosts: PostType[] = [];

  // First pass: Create map of all posts
  posts.forEach(post => {
    postMap.set(post.id, { ...post, comments: [] });
  });

  // Second pass: Build hierarchy
  posts.forEach(post => {
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

  return rootPosts;
};

const Index = () => {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<PostType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;

      const hierarchicalPosts = buildHierarchy(data || []);
      setPosts(hierarchicalPosts);
      setFilteredPosts(hierarchicalPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
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

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      if (!searchQuery.trim()) {
        setFilteredPosts(posts);
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .ilike('content', `%${searchQuery}%`)
        .order('id', { ascending: false });

      if (error) throw error;

      const hierarchicalPosts = buildHierarchy(data || []);
      setFilteredPosts(hierarchicalPosts);
    } catch (error) {
      console.error('Error searching posts:', error);
      toast({
        title: "Error",
        description: "Failed to search posts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIClick = () => {
    toast({
      title: "AI Assistant",
      description: "AI functionality coming soon!",
    });
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
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <Button variant="ghost" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={handleAIClick}>
              <Bot className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-1/4" />
        </div>

        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center">Loading posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center">No posts found</div>
          ) : (
            filteredPosts.map((post, index) => (
              <Post
                key={post.id}
                id={post.id}
                content={post.content}
                comments={post.comments || []}
                onUpdate={loadPosts}
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