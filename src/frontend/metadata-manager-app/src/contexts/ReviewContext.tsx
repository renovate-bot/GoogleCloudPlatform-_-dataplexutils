import React, { createContext, useContext, useReducer } from 'react';

interface MetadataItem {
  id: string;
  type: 'table' | 'column';
  name: string;
  currentDescription: string;
  draftDescription: string;
  isHtml: boolean;
  status: 'draft' | 'accepted' | 'rejected';
  lastModified: string;
  comments: Array<{
    id: string;
    text: string;
    type: 'human' | 'negative';
    timestamp: string;
  }>;
  'to-be-regenerated'?: boolean;
  isMarkingForRegeneration?: boolean;
  generationDate?: string;
  whenAccepted?: string;
  externalDocumentUri?: string;
}

interface ReviewState {
  items: MetadataItem[];
  pageToken: string | null;
  totalCount: number;
  currentItemIndex: number;
  viewMode: 'list' | 'review';
  hasLoadedItems: boolean;
}

type ReviewAction =
  | { type: 'SET_ITEMS'; payload: MetadataItem[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<MetadataItem> } }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'SET_PAGE_TOKEN'; payload: string | null }
  | { type: 'SET_TOTAL_COUNT'; payload: number }
  | { type: 'SET_CURRENT_INDEX'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: 'list' | 'review' }
  | { type: 'SET_HAS_LOADED'; payload: boolean }
  | { type: 'APPEND_ITEMS'; payload: MetadataItem[] };

const initialState: ReviewState = {
  items: [],
  pageToken: null,
  totalCount: 0,
  currentItemIndex: 0,
  viewMode: 'list',
  hasLoadedItems: false,
};

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload.updates }
            : item
        ),
      };
    case 'DELETE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
      };
    case 'SET_PAGE_TOKEN':
      return { ...state, pageToken: action.payload };
    case 'SET_TOTAL_COUNT':
      return { ...state, totalCount: action.payload };
    case 'SET_CURRENT_INDEX':
      return { ...state, currentItemIndex: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_HAS_LOADED':
      return { ...state, hasLoadedItems: action.payload };
    case 'APPEND_ITEMS':
      return { ...state, items: [...state.items, ...action.payload] };
    default:
      return state;
  }
}

interface ReviewContextType {
  state: ReviewState;
  dispatch: React.Dispatch<ReviewAction>;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

export const ReviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reviewReducer, initialState);

  return (
    <ReviewContext.Provider value={{ state, dispatch }}>
      {children}
    </ReviewContext.Provider>
  );
};

export const useReview = () => {
  const context = useContext(ReviewContext);
  if (context === undefined) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}; 