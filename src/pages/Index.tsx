import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const Index = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPosts, setFilteredPosts] = useState<any[]>([]);

  const loadPosts = () => {
    const storedPosts = JSON.parse(localStorage.getItem("posts") || "[]");
    setPosts(storedPosts);
    setFilteredPosts(storedPosts);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
      return;
    }
    const filtered = posts.filter(post => 
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPosts(filtered);
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
          </div>
          <div className="w-1/4" />
        </div>

        <div className="space-y-6">
          {filteredPosts.length === 0 ? (
            <div className="text-center text-xl">hello, world</div>
          ) : (
            filteredPosts.map((post) => (
              <Post
                key={post.id}
                id={post.id}
                content={post.content}
                comments={post.comments}
                onUpdate={loadPosts}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;