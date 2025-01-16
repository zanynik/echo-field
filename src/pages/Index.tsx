import { useState, useEffect } from "react";
import { Post } from "@/components/Post";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const [posts, setPosts] = useState<any[]>([]);

  const loadPosts = () => {
    const storedPosts = JSON.parse(localStorage.getItem("posts") || "[]");
    setPosts(storedPosts);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Forum</h1>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center text-xl">hello, world</div>
          ) : (
            posts.map((post, index) => (
              <Post
                key={post.id}
                id={post.id}
                content={post.content}
                comments={post.comments}
                onUpdate={loadPosts}
                isFirstPost={index === 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;