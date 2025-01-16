import React, { useState } from 'react';
import styles from './Post.module.css';
import Comment from './Comment';

function Post({ post, isLast }) {
  const [showComments, setShowComments] = useState(false);

  const postClasses = `${styles.post} ${isLast ? styles.lastPost : ''}`

  const handlePostClick = (e) => {
    // Only toggle comments if clicking the text area
    if (e.target.closest(`.${styles.postContent}`)) {
      setShowComments(!showComments);
    }
  };

  return (
    <div className={postClasses}>
      <div className={styles.postContent} onClick={handlePostClick}>
        {/* existing post content... */}
      </div>
      
      <div className={styles.interactions}>
        {/* existing interaction buttons... */}
      </div>

      {showComments && (
        <div className={styles.comments}>
          {post.comments?.map((comment, index) => (
            <Comment key={index} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Post; 