import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export const CreatePost = ({ onPostCreated }: { onPostCreated: () => void }) => {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Post cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // In a real app, this would be an API call
    const posts = JSON.parse(localStorage.getItem("posts") || "[]");
    const newPost = {
      id: Date.now().toString(),
      content,
      comments: [],
    };
    localStorage.setItem("posts", JSON.stringify([newPost, ...posts]));
    
    setContent("");
    onPostCreated();
    
    toast({
      title: "Success",
      description: "Post created successfully",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="Share your thoughts anonymously..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px] resize-none"
      />
      <Button type="submit" className="w-full">
        Post Anonymously
      </Button>
    </form>
  );
};