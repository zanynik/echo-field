import { FaSearch, FaRobot } from 'react-icons/fa';

function SearchBar({ onSearch }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className={styles.searchContainer}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.iconButton}>
          <FaSearch />
        </button>
        <button type="button" className={styles.iconButton}>
          <FaRobot />
        </button>
      </form>
    </div>
  );
} 