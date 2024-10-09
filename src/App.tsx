/**
 * Since this file is for development purposes only, some of the dependencies are in devDependencies
 * Disabling ESLint rules for these dependencies since we know it is only for development purposes
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import ReactDOMClient from 'react-dom/client';
// eslint-disable-next-line import/no-extraneous-dependencies
import styled, { createGlobalStyle } from 'styled-components';
// import shuffle from 'lodash/shuffle';
import {
  useFocusable,
  init,
  FocusContext,
  FocusDetails,
  FocusableComponentLayout,
  KeyPressDetails
} from './index';

init({
  debug: false,
  visualDebug: false,
  distanceCalculationMethod: 'center'
});

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = '6f2345080ac02f962901b6baa3723f58'; // Replace with your actual API key
const ACCESS_TOKEN = 'YeyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZjIzNDUwODBhYzAyZjk2MjkwMWI2YmFhMzcyM2Y1OCIsInN1YiI6IjY1NmFhZDExZjBmNTBlZDEwNWIzNTM0YyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Z-oU6dL94w36cr2WWJ8P7lR4-5qskfqFYXj82I3kGng'; // Replace with your actual access token

// Add this function near the top of your file, after the imports
const handleError = (error: Error) => {
  // You can implement more sophisticated error handling here
  // For now, we'll just throw the error
  throw error;
};

// Update the rows array to use the correct types
const rows = [
  { title: 'Popular Movies', type: 'movie' as const, endpoint: '/movie/popular' },
  { title: 'Top Rated Movies', type: 'movie' as const, endpoint: '/movie/top_rated' },
  { title: 'Popular TV Shows', type: 'tv' as const, endpoint: '/tv/popular' },
  { title: 'Top Rated TV Shows', type: 'tv' as const, endpoint: '/tv/top_rated' },
];

interface MenuItemBoxProps {
  focused: boolean;
}

const NETFLIX_RED = '#E50914';
const NETFLIX_BLACK = '#141414';
const NETFLIX_DARK_GRAY = '#222222';
const NETFLIX_LIGHT_GRAY = '#757575';

const MenuItemBox = styled.div<MenuItemBoxProps>`
  width: 171px;
  height: 51px;
  background-color: ${({ focused }) => focused ? NETFLIX_RED : NETFLIX_LIGHT_GRAY};
  color: white;
  border: none;
  border-radius: 3px;
  margin-bottom: 37px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background-color 0.2s ease;
`;

interface MenuItemProps {
  label: string;
  onItemPress: () => void;
}

function MenuItem({ label, onItemPress }: MenuItemProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: onItemPress
  });

  return <MenuItemBox ref={ref} focused={focused} onClick={onItemPress}>{label}</MenuItemBox>;
}

interface MenuWrapperProps {
  hasFocusedChild: boolean;
}

const MenuWrapper = styled.div<MenuWrapperProps>`
  flex: 1;
  max-width: 246px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: ${NETFLIX_BLACK};
  padding-top: 37px;
`;

const NmLogo = styled.div`
  font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-size: 48px;
  color: ${NETFLIX_RED};
  margin-bottom: 51px;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const SearchBar = styled.input`
  width: 90%;
  padding: 8px;
  margin-bottom: 20px;
  background-color: ${NETFLIX_DARK_GRAY};
  border: 1px solid ${NETFLIX_LIGHT_GRAY};
  border-radius: 4px;
  color: white;
  font-size: 14px;

  &::placeholder {
    color: ${NETFLIX_LIGHT_GRAY};
  }

  &:focus {
    outline: none;
    border-color: ${NETFLIX_RED};
  }
`;

interface MenuProps {
  focusKey: string;
  onItemPress: (item: string) => void;
  onSearch: (query: string) => void;
}

function Menu({ focusKey: focusKeyParam, onItemPress, onSearch }: MenuProps) {
  const {
    ref,
    focusSelf,
    hasFocusedChild,
    focusKey
  } = useFocusable({
    focusable: true,
    saveLastFocusedChild: false,
    trackChildren: true,
    autoRestoreFocus: true,
    isFocusBoundary: false,
    focusKey: focusKeyParam,
    preferredChildFocusKey: null,
  });

  useEffect(() => {
    focusSelf();
  }, [focusSelf]);

  const handleItemPress = useCallback((item: string) => {
    onItemPress(item);
  }, [onItemPress]);

  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(event.target.value);
  }, [onSearch]);

  return (
    <FocusContext.Provider value={focusKey}>
      <MenuWrapper ref={ref} hasFocusedChild={hasFocusedChild}>
        <NmLogo>Notflix</NmLogo>
        <SearchBar 
          type="text" 
          placeholder="Search movies, shows, people..." 
          onChange={handleSearch}
        />
        <MenuItem label="Home" onItemPress={() => handleItemPress('Home')} />
        <MenuItem label="TV Shows" onItemPress={() => handleItemPress('TV Shows')} />
        <MenuItem label="Movies" onItemPress={() => handleItemPress('Movies')} />
        <MenuItem label="New & Popular" onItemPress={() => handleItemPress('New & Popular')} />
        <MenuItem label="My List" onItemPress={() => handleItemPress('My List')} />
        <MenuItem label="P for Vlad" onItemPress={() => handleItemPress('Porn for Vlad')} />
      </MenuWrapper>
    </FocusContext.Provider>
  );
}

const AssetWrapper = styled.div`
  margin-right: 22px;
  display: flex;
  flex-direction: column;
`;

interface AssetBoxProps {
  focused: boolean;
}

const AssetBox = styled.div<AssetBoxProps>`
  width: 225px;
  height: auto;
  background-color: ${NETFLIX_DARK_GRAY};
  border: ${({ focused }) => focused ? `3px solid white` : 'none'};
  box-sizing: border-box;
  border-radius: 4px;
  transition: transform 0.2s ease;
  transform: ${({ focused }) => focused ? 'scale(1.05)' : 'scale(1)'};
`;

const AssetTitle = styled.div`
  color: white;
  margin-top: 10px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
`;

interface AssetProps {
  id: number;
  title: string;
  posterPath: string;
  onEnterPress: (props: object, details: KeyPressDetails) => void;
  onFocus: (
    layout: FocusableComponentLayout,
    props: object,
    details: FocusDetails
  ) => void;
}

interface AssetProps {
  id: number;
  title: string;
  posterPath: string;
  type: 'movie' | 'tv';
  onEnterPress: (props: object, details: KeyPressDetails) => void;
  onFocus: (
    layout: FocusableComponentLayout,
    props: object,
    details: FocusDetails
  ) => void;
}

function Asset({ id, title, posterPath, type, onEnterPress, onFocus }: AssetProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: (details: KeyPressDetails) => onEnterPress({ id, title, posterPath, type }, details),
    onFocus,
    extraProps: {
      id,
      title,
      posterPath,
      type
    }
  });

  return (
    <AssetWrapper ref={ref}>
      <AssetBox focused={focused}>
        <img src={`https://image.tmdb.org/t/p/w200${posterPath}`} alt={title} />
      </AssetBox>
      <AssetTitle>{title}</AssetTitle>
    </AssetWrapper>
  );
}

const ContentRowWrapper = styled.div`
  margin-bottom: 37px;
`;

const ContentRowTitle = styled.div`
  color: white;
  margin-bottom: 22px;
  font-size: 24px;
  font-weight: 600;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  padding-left: 60px;
`;

const ContentRowScrollingWrapper = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 1;
  flex-grow: 1;
  padding-left: 60px;
`;

const ContentRowScrollingContent = styled.div`
  display: flex;
  flex-direction: row;
`;

// Update the ContentRowProps interface
interface ContentRowProps {
  title: string;
  type: 'movie' | 'tv';
  endpoint: string;
  onAssetPress: (props: object, details: KeyPressDetails) => void;
  onFocus: (
    layout: FocusableComponentLayout,
    props: object,
    details: FocusDetails
  ) => void;
  items?: any[];
}

function ContentRow({ title: rowTitle, type, endpoint, onAssetPress, onFocus, items }: ContentRowProps) {
  const { ref, focusKey } = useFocusable({ onFocus });
  const scrollingRef = useRef(null);
  const [fetchedItems, setFetchedItems] = useState([]);

  useEffect(() => {
    if (items) {
      setFetchedItems(items);
    } else {
      fetch(`${API_BASE_URL}${endpoint}?api_key=${API_KEY}`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json;charset=utf-8'
        }
      })
        .then(response => response.json())
        .then(data => setFetchedItems(data.results.slice(0, 10))) // Limit to 10 items
        .catch(handleError);
    }
  }, [endpoint, items]);

  const onAssetFocus = useCallback(
    ({ x }: { x: number }) => {
      scrollingRef.current.scrollTo({
        left: x,
        behavior: 'smooth'
      });
    },
    [scrollingRef]
  );

  

  return (
    <FocusContext.Provider value={focusKey}>
      <ContentRowWrapper ref={ref}>
        {rowTitle && <ContentRowTitle>{rowTitle}</ContentRowTitle>}
        <ContentRowScrollingWrapper ref={scrollingRef}>
          <ContentRowScrollingContent>
            {fetchedItems.map((item) => (
              <Asset
                key={item.id}
                id={item.id}
                title={type === 'movie' ? item.title : item.name}
                posterPath={item.poster_path}
                type={item.media_type || type}
                onEnterPress={onAssetPress}
                onFocus={onAssetFocus}
              />
            ))}
          </ContentRowScrollingContent>
        </ContentRowScrollingWrapper>
      </ContentRowWrapper>
    </FocusContext.Provider>
  );
}

ContentRow.defaultProps = {
  items: undefined,
};

const ContentWrapper = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: ${NETFLIX_BLACK};
  margin-top:24px;
`;

const SelectedItemWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SelectedItemBox = styled.div`
  display: flex;
  background-color: ${NETFLIX_BLACK};
  border-radius: 4px;
  overflow: hidden;
`;


const ScrollingRows = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 1;
  flex-grow: 1;
`;

const SelectedItemDetails = styled.div`
  padding: 20px;
  color: white;
`;

const TrailerButton = styled.button`
  background-color: white;
  color: ${NETFLIX_BLACK};
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  margin-right: 10px;
  cursor: pointer;
  font-weight: bold;
`;

const WatchButton = styled.button`
  background-color: ${NETFLIX_RED};
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
`;

// Add this new styled component for the close button
const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background-color: rgba(0, 0, 0, 0.7);
  }
`;

// Add these new styled components
const PillContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 24px;
`;

const Pill = styled.button`
  background-color: ${NETFLIX_DARK_GRAY};
  color: ${NETFLIX_LIGHT_GRAY};
  border: none;
  border-radius: 20px;
  padding: 5px 10px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${NETFLIX_LIGHT_GRAY};
    color: white;
  }
`;

async function getImdbId(tmdbId: string, mediaType: 'movie' | 'tv'): Promise<string | null> {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const externalIdsUrl = `${API_BASE_URL}/${endpoint}/${tmdbId}/external_ids?api_key=${API_KEY}`;
    try {
        const response = await fetch(externalIdsUrl, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json;charset=utf-8'
            }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        return data.imdb_id || null;
    } catch (error) {
        // Instead of logging to console, we'll return null on error
        return null;
    }
}

const PersonCreditsWrapper = styled.div`
  margin-bottom: 20px; // Add some space between the person's credits and the main content
`;

interface ContentProps {
  searchQuery: string;
}

// Add this interface near the top of your file, with other interfaces
interface FetchedItems {
  [key: string]: any[];
}

function Content({ searchQuery }: ContentProps) {
  const { ref, focusKey } = useFocusable();
  const [selectedAsset, setSelectedAsset] = useState<AssetProps | null>(null);
  const [assetDetails, setAssetDetails] = useState<any | null>(null);
  const [personCredits, setPersonCredits] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [creditFilter, setCreditFilter] = useState('all');
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [fetchedItems, setFetchedItems] = useState<FetchedItems>({});

  const onAssetPress = useCallback((asset: AssetProps) => {
    setSelectedAsset(asset);
    setImdbId(null); // Reset IMDb ID when a new asset is selected
    // Fetch detailed information
    fetch(`${API_BASE_URL}/${asset.type}/${asset.id}?api_key=${API_KEY}&append_to_response=credits,videos`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8'
      }
    })
      .then(response => response.json())
      .then(data => {
        setAssetDetails(data);
        // Fetch IMDb ID
        getImdbId(asset.id.toString(), asset.type).then(id => setImdbId(id));
      })
      .catch(handleError);
  }, []);

  // Add this new function to clear the selected asset
  const clearSelectedAsset = useCallback(() => {
    setSelectedAsset(null);
    setAssetDetails(null);
  }, []);

  const onRowFocus = useCallback(
    ({ y }: { y: number }) => {
      ref.current.scrollTo({
        top: y,
        behavior: 'smooth'
      });
    },
    [ref]
  );

  const handlePersonClick = useCallback((person: { id: number; name: string }) => {
    setSelectedAsset(null); // Clear the currently selected asset
    setAssetDetails(null); // Clear the asset details
    
    fetch(`${API_BASE_URL}/person/${person.id}/combined_credits?api_key=${API_KEY}`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8'
      }
    })
      .then(response => response.json())
      .then(data => {
        setPersonCredits(data);
        setSelectedPerson(person);
        setCreditFilter('all'); // Reset filter when new person is selected
      })
      .catch(handleError);
  }, []);

  const renderPersonCredits = useCallback(() => {
    if (!personCredits || !selectedPerson) return null;
    
    const credits = [...(personCredits.cast || []), ...(personCredits.crew || [])];
    
    const filteredCredits = credits.filter(credit => 
      creditFilter === 'all' || credit.media_type === creditFilter
    );

    const sortedCredits = filteredCredits
      .sort((a, b) => b.popularity - a.popularity)
      .filter((credit, index, self) => 
        index === self.findIndex((t) => t.id === credit.id)
      )
      .slice(0, 20); // Show top 20 works

    return (
      <div>
        <h3>{selectedPerson.name}&apos;s Top Works</h3>
        <div>
          <button type="button" onClick={() => setCreditFilter('all')}>All</button>
          <button type="button" onClick={() => setCreditFilter('movie')}>Movies</button>
          <button type="button" onClick={() => setCreditFilter('tv')}>TV Shows</button>
        </div>
        <ContentRow
          title={creditFilter === 'all' ? 'All Credits' : creditFilter === 'movie' ? 'Movies' : 'TV Shows'}
          type={creditFilter === 'tv' ? 'tv' : 'movie'}
          endpoint=""
          onAssetPress={onAssetPress}
          onFocus={onRowFocus}
          items={sortedCredits.map(credit => ({
            id: credit.id,
            title: credit.title || credit.name,
            poster_path: credit.poster_path,
            media_type: credit.media_type
          }))}
        />
      </div>
    );
  }, [personCredits, selectedPerson, onAssetPress, onRowFocus, creditFilter, setCreditFilter]);

  useEffect(() => {
    if (searchQuery) {
      fetch(`${API_BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json;charset=utf-8'
        }
      })
        .then(response => response.json())
        .then(data => {
          const searchResults = data.results.filter((item: { media_type: string }) => 
            item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person'
          );
          setPersonCredits(null);
          setSelectedPerson(null);
          setSelectedAsset(null);
          setAssetDetails(null);
          // Update the first row with search results
          setFetchedItems(prevItems => ({
            ...prevItems,
            'Search Results': searchResults
          }));
        })
        .catch(handleError);
    }
  }, [searchQuery]);

  return (
    <FocusContext.Provider value={focusKey}>
      <ContentWrapper>
        
        {selectedAsset && assetDetails && (
          <SelectedItemWrapper>
            <CloseButton type="button" onClick={clearSelectedAsset}>&times;</CloseButton>
            <SelectedItemBox>
              <img 
                src={`https://image.tmdb.org/t/p/w500${selectedAsset.posterPath}`} 
                alt={selectedAsset.title} 
              />
              <SelectedItemDetails>
                <h2>{assetDetails.title || assetDetails.name}</h2>
                <p>
                  {assetDetails.overview.length > 200 
                    ? `${assetDetails.overview.substring(0, 200)}...`
                    : assetDetails.overview}
                </p>
                
                <h3>Directors:</h3>
                <PillContainer>
                  {assetDetails.credits.crew
                    .filter((person: { job: string }) => person.job === 'Director')
                    .map((director: { id: number; name: string }) => (
                      <Pill 
                        key={director.id} 
                        onClick={() => handlePersonClick(director)}
                        type="button"
                      >
                        {director.name}
                      </Pill>
                    ))
                  }
                </PillContainer>

                <h3>Top Cast:</h3>
                <PillContainer>
                  {assetDetails.credits.cast.slice(0, 10).map((actor: { id: number; name: string }) => (
                    <Pill 
                      key={actor.id} 
                      onClick={() => handlePersonClick(actor)}
                      type="button"
                    >
                      {actor.name}
                    </Pill>
                  ))}
                </PillContainer>

                {assetDetails.videos.results.length > 0 && (
                  <TrailerButton 
                    type="button"
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${assetDetails.videos.results[0].key}`, '_blank')}
                  >
                    Watch Trailer
                  </TrailerButton>
                )}
                <WatchButton 
                  type="button"
                  onClick={() => {
                    const watchLink = imdbId 
                      ? `https://vidsrc.xyz/embed/${selectedAsset.type}?imdb=${imdbId}`
                      : `https://vidsrc.xyz/embed/${selectedAsset.type}?tmdb=${selectedAsset.id}`;
                    window.open(watchLink, '_blank');
                  }}
                >
                  Watch {selectedAsset.type === 'movie' ? 'Movie' : 'TV Show'}
                </WatchButton>
              </SelectedItemDetails>
            </SelectedItemBox>
          </SelectedItemWrapper>
        )}
        {selectedPerson && (
          <PersonCreditsWrapper>
            {renderPersonCredits()}
          </PersonCreditsWrapper>
        )}
        <ScrollingRows ref={ref}>
          {searchQuery && fetchedItems['Search Results'] && (
            <ContentRow
              key="Search Results"
              title="Search Results"
              type="movie"
              endpoint=""
              onAssetPress={onAssetPress}
              onFocus={onRowFocus}
              items={fetchedItems['Search Results'] || []}
            />
          )}
          {rows.map(({ title, type, endpoint }) => (
            <ContentRow
              key={title}
              title={title}
              type={type}
              endpoint={endpoint}
              onAssetPress={onAssetPress}
              onFocus={onRowFocus}
            />
          ))}
        </ScrollingRows>
      </ContentWrapper>
    </FocusContext.Provider>
  );
}

const AppContainer = styled.div`
  background-color: ${NETFLIX_BLACK};
  width: 1440px;
  height: 810px;
  display: flex;
  flex-direction: row;
`;

const GlobalStyle = createGlobalStyle`
  ::-webkit-scrollbar {
    display: none;
  }
`;



function App() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleMenuItemPress = useCallback((item: string) => {
    console.log(`Menu item pressed: ${item}`);
    if (item === 'P for Vlad') {
      window.location.href = 'https://lemonparty.org/';
    }
    // ... handle other menu items ...
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <React.StrictMode>
      <AppContainer>
        <GlobalStyle />
        <Menu 
          focusKey="MENU" 
          onItemPress={handleMenuItemPress} 
          onSearch={handleSearch}
        />
        <Content searchQuery={searchQuery} />
      </AppContainer>
    </React.StrictMode>
  );
}

const root = ReactDOMClient.createRoot(document.querySelector('#root'));

root.render(<App />);