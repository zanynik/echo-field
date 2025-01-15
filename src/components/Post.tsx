import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  content: string;
}

interface PostProps {
  id: string;
  content: string;
  comments: Comment[];
  onUpdate: () => void;
}

export const Post = ({ id, content, comments, onUpdate }: PostProps) => {
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const { toast } = useToast();

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const posts = JSON.parse(localStorage.getItem("posts") || "[]");
    const postIndex = posts.findIndex((p: any) => p.id === id);
    
    if (postIndex !== -1) {
      posts[postIndex].comments.push({
        id: Date.now().toString(),
        content: newComment,
      });
      localStorage.setItem("posts", JSON.stringify(posts));
      setNewComment("");
      onUpdate();
      
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <p className="whitespace-pre-wrap">{content}</p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide Comments" : "Show Comments"}
        </Button>
        
        {showComments && (
          <div className="w-full space-y-4">
            {comments.map((comment) => (
              <Card key={comment.id} className="w-full bg-muted">
                <CardContent className="p-4">
                  <p className="text-sm">{comment.content}</p>
                </CardContent>
              </Card>
            ))}
            
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="resize-none"
              />
              <Button
                onClick={handleAddComment}
                className="w-full"
                variant="outline"
              >
                Comment Anonymously
              </Button>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};