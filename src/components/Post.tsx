import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  content: string;
  comments: Comment[];
}

interface PostProps {
  id: string;
  content: string;
  comments: Comment[];
  onUpdate: () => void;
  depth?: number;
}

export const Post = ({ id, content, comments = [], onUpdate, depth = 0 }: PostProps) => {
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
    
    // Helper function to add comment to nested structure
    const addCommentToStructure = (items: any[], targetId: string): boolean => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) {
          items[i].comments.push({
            id: Date.now().toString(),
            content: newComment,
            comments: [],
          });
          return true;
        }
        if (items[i].comments && items[i].comments.length > 0) {
          if (addCommentToStructure(items[i].comments, targetId)) {
            return true;
          }
        }
      }
      return false;
    };

    if (depth === 0) {
      const postIndex = posts.findIndex((p: any) => p.id === id);
      if (postIndex !== -1) {
        posts[postIndex].comments.push({
          id: Date.now().toString(),
          content: newComment,
          comments: [],
        });
      }
    } else {
      addCommentToStructure(posts, id);
    }

    localStorage.setItem("posts", JSON.stringify(posts));
    setNewComment("");
    onUpdate();
    
    toast({
      title: "Success",
      description: "Comment added successfully",
    });
  };

  return (
    <Card className={`w-full ${depth > 0 ? "ml-4" : ""}`}>
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
            {comments && comments.map((comment) => (
              <Post
                key={comment.id}
                id={comment.id}
                content={comment.content}
                comments={comment.comments}
                onUpdate={onUpdate}
                depth={depth + 1}
              />
            ))}
            
            <div className="space-y-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="resize-none"
              />
              <Button
                onClick={handleAddComment}
                className="w-full"
                variant="outline"
              >
                Comment
              </Button>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};