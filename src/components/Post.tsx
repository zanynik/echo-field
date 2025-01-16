import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { MessageCircle, Send, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
  isLast?: boolean;
}

export const Post = ({ id, content, comments = [], onUpdate, depth = 0, isLast = false }: PostProps & { isLast?: boolean }) => {
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [showWriteComment, setShowWriteComment] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();

  const handleContentClick = () => {
    setShowComments(!showComments);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            content: newComment,
            parent_id: id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setNewComment("");
      setShowWriteComment(false);
      onUpdate();
      
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  const themeBasedClass = isLast
    ? theme === 'dark'
      ? 'bg-white/90 text-black'
      : 'bg-black/90 text-white'
    : '';

  const iconColor = theme === 'dark' ? 'white' : 'black';
  const oppositeColor = theme === 'dark' ? 'black' : 'white';

  return (
    <Card className={`w-full ${depth > 0 ? "ml-4" : ""} ${themeBasedClass}`}>
      <CardContent className="pt-6 cursor-pointer" onClick={handleContentClick}>
        <p className="whitespace-pre-wrap">{content}</p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="w-full space-y-4">
          <div className="flex gap-2">
            {comments.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1 hover:bg-transparent group"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageCircle 
                  className="transition-all duration-200"
                  fill={showComments ? oppositeColor : "transparent"}
                  color={iconColor}
                />
              </Button>
            )}
            <Button
              variant="ghost"
              className="flex-1 hover:bg-transparent group"
              onClick={() => setShowWriteComment(!showWriteComment)}
            >
              <Pencil 
                className="transition-all duration-200"
                fill={showWriteComment ? oppositeColor : "transparent"}
                color={iconColor}
              />
            </Button>
          </div>

          {showWriteComment && (
            <div className="space-y-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="resize-none"
              />
              <Button
                onClick={handleAddComment}
                className="w-full hover:bg-transparent"
                variant="outline"
              >
                <Send color={iconColor} />
              </Button>
            </div>
          )}
        </div>
        
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
          </div>
        )}
      </CardFooter>
    </Card>
  );
};