import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';

const GIPHY_API_KEY = 'EATf1wMx3AVqXgsouxI6sm5CFYqjO2NG'; // API Key de desarrollo pública de Giphy

const FALLBACK_GIFS = [
  {
    id: 'excited_jonah',
    url: 'https://media.giphy.com/media/5GoVL6q6o7EPy/giphy.gif',
    title: 'Jonah Hill Excited Celeb Celebration',
    keywords: ['excited', 'celebration', 'happy', 'yes', 'screaming', 'celebrate']
  },
  {
    id: 'minions_cheering',
    url: 'https://media.giphy.com/media/MOWPkhRAhEW3I/giphy.gif',
    title: 'Minions Cheering Happy',
    keywords: ['cheering', 'happy', 'minions', 'celebrate', 'yes', 'joy']
  },
  {
    id: 'confused_travolta',
    url: 'https://media.giphy.com/media/hFmIU5G72Yx1K/giphy.gif',
    title: 'Confused John Travolta Lost',
    keywords: ['confused', 'lost', 'where', 'travolta', 'what', 'question']
  },
  {
    id: 'homer_simpson_bush',
    url: 'https://media.giphy.com/media/COYGe9r7vhKoo/giphy.gif',
    title: 'Homer Simpson Backing Into Bush',
    keywords: ['homer', 'simpson', 'bush', 'hide', 'bye', 'leave', 'awkward']
  },
  {
    id: 'michael_scott_no',
    url: 'https://media.giphy.com/media/d10dKmZrWdxZe/giphy.gif',
    title: 'Michael Scott No God Please No',
    keywords: ['no', 'please', 'michael', 'scott', 'office', 'hate', 'angry']
  },
  {
    id: 'shocked_pikachu',
    url: 'https://media.giphy.com/media/3kzJvFeNaUmX9DfcVZ/giphy.gif',
    title: 'Shocked Pikachu Face',
    keywords: ['shocked', 'pikachu', 'pokemon', 'surprise', 'what', 'omg']
  },
  {
    id: 'rick_astley_dance',
    url: 'https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif',
    title: 'Rick Astley Rickroll Dance',
    keywords: ['rickroll', 'rick', 'astley', 'dance', 'music', 'lol', 'troll']
  },
  {
    id: 'dicaprio_toast',
    url: 'https://media.giphy.com/media/8IvDg3ZGimY8g/giphy.gif',
    title: 'Leonardo DiCaprio Toast Great Gatsby',
    keywords: ['toast', 'cheers', 'leo', 'dicaprio', 'gatsby', 'classy', 'respect']
  },
  {
    id: 'cat_typing',
    url: 'https://media.giphy.com/media/o0vc1AncKaT6M/giphy.gif',
    title: 'Cat Typing Fast Keyboard',
    keywords: ['cat', 'typing', 'work', 'fast', 'keyboard', 'computer', 'coding']
  },
  {
    id: 'baby_dancing',
    url: 'https://media.giphy.com/media/14s7HoDYNAXw3y/giphy.gif',
    title: 'Baby Dancing Happy',
    keywords: ['baby', 'dance', 'happy', 'funny', 'groove']
  },
  {
    id: 'popcorn_eating',
    url: 'https://media.giphy.com/media/NipFetnQOW5aM/giphy.gif',
    title: 'Popcorn Eating Watching Drama',
    keywords: ['popcorn', 'eating', 'watching', 'drama', 'movie', 'interesing']
  },
  {
    id: 'obama_mic_drop',
    url: 'https://media.giphy.com/media/3o7qDEq28lJf65EemA/giphy.gif',
    title: 'Barack Obama Mic Drop Done',
    keywords: ['mic', 'drop', 'obama', 'done', 'victory', 'cool']
  },
  {
    id: 'dog_wink',
    url: 'https://media.giphy.com/media/mRvWTv9u1CYmg/giphy.gif',
    title: 'Dog Winking Cute',
    keywords: ['dog', 'wink', 'cute', 'puppy', 'flirt', 'agree']
  },
  {
    id: 'mind_blown',
    url: 'https://media.giphy.com/media/xT0xeJpD8eDYM1D30c/giphy.gif',
    title: 'Mind Blown Explosion',
    keywords: ['mind', 'blown', 'explosion', 'wow', 'amazing', 'science']
  },
  {
    id: 'carlton_dance',
    url: 'https://media.giphy.com/media/12UlfHpF05ielO/giphy.gif',
    title: 'Carlton Dance Fresh Prince',
    keywords: ['carlton', 'dance', 'happy', 'fresh', 'prince', 'funny']
  },
  {
    id: 'baby_yoda_soup',
    url: 'https://media.giphy.com/media/83uF0IT640O3Q/giphy.gif',
    title: 'Baby Yoda Sipping Soup Mandalorian',
    keywords: ['yoda', 'soup', 'sip', 'cute', 'mandalorian', 'watching', 'chill']
  }
];

export function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  const fetchGifs = async (searchQuery = '') => {
    setLoading(true);
    try {
      const url = searchQuery
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=15&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=15&rating=g`;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Giphy API error: ${res.status}`);
      }
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const items = data.data.map(item => ({
          id: item.id,
          url: item.images.fixed_width.url,
          title: item.title
        }));
        setGifs(items);
      } else {
        throw new Error('Empty response from Giphy');
      }
    } catch (err) {
      console.warn('Giphy API failed, using high-quality local fallback GIFs:', err);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const filtered = FALLBACK_GIFS.filter(gif => 
          gif.title.toLowerCase().includes(q) || 
          gif.keywords.some(kw => kw.includes(q))
        );
        setGifs(filtered);
      } else {
        setGifs(FALLBACK_GIFS);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs();
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchGifs(val);
    }, 400);
  };

  return (
    <div className="absolute bottom-full right-0 mb-1 z-50 w-96 h-[420px] rounded-xl border border-border bg-popover/95 backdrop-blur-md p-3 shadow-2xl flex flex-col gap-2.5 animate-scale-in">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder="Buscar GIFs en Giphy..."
          className="w-full pl-8 pr-3 py-1.5 bg-card/60 border border-border/65 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          autoFocus
        />
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin rounded-lg">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No se encontraron GIFs
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 p-0.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelect(gif.url);
                  onClose();
                }}
                className="relative aspect-video w-full rounded-md overflow-hidden bg-muted hover:scale-[1.03] active:scale-95 transition-all duration-200"
              >
                <img
                  src={gif.url}
                  alt={gif.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
