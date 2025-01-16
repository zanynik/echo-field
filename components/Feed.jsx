import React, { useState } from 'react';
import SearchBar from './SearchBar';
import Post from './Post';
import styles from './Feed.module.css';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      setFilteredPosts([]);
      return;
    }

    setIsSearching(true);
    const searchResults = posts.filter(post => 
      post.content.toLowerCase().includes(query.toLowerCase()) ||
      post.author.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredPosts(searchResults);
  };

  return (
    <div className={styles.feed}>
      <SearchBar onSearch={handleSearch} />
      {(isSearching ? filteredPosts : posts).map((post, index) => (
        <Post 
          key={post.id} 
          post={post} 
          isLast={index === (isSearching ? filteredPosts.length - 1 : posts.length - 1)}
        />
      ))}
    </div>
  );
}

export default Feed; 