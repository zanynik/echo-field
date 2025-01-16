import React from 'react';

interface CommentProps {
  comment: {
    id: string;
    content: string;
    replies?: CommentProps['comment'][];
  };
  depth?: number;
}

const styles = {
  commentContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
  },
  commentThread: {
    marginLeft: '20px',
    borderLeft: '2px solid #ccc',
    paddingLeft: '20px',
    width: 'calc(100% - 40px)',
  },
  commentBox: {
    width: '100%',
    minHeight: '100px',
    resize: 'vertical' as const,
    marginBottom: '10px',
  }
} as const;

export const Comment: React.FC<CommentProps> = ({ comment, depth = 0 }) => {
  return (
    <div style={styles.commentContainer}>
      <div className="comment-content">
        {comment.content}
      </div>
      
      {comment.replies && (
        <div style={styles.commentThread}>
          {comment.replies.map(reply => (
            <Comment key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
      
      <textarea 
        style={styles.commentBox}
        placeholder="Write a reply..."
      />
    </div>
  );
}; 