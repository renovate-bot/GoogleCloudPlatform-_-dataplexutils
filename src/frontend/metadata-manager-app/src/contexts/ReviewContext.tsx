/*
Copyright 2025 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

import React, { createContext, useContext, useReducer } from 'react';

export interface MetadataItem {
  id: string;
  type: 'table' | 'column';
  name: string;
  status: 'draft' | 'accepted' | 'rejected' | 'current';
  currentDescription?: string;
  draftDescription?: string;
  whenAccepted?: string;
  lastModified: string;
  comments?: string[];
  tags?: Record<string, string>;
  metadata?: {
    certified?: boolean;
    user_who_certified?: string;
    generation_date?: string;
    external_document_uri?: string;
  };
  profile?: {
    name?: string;
    type?: string;
    mode?: string;
    null_ratio?: number;
    distinct_ratio?: number;
    average?: number;
    std_dev?: number;
    min?: number | string;
    max?: number | string;
    quartiles?: number[];
    min_length?: number;
    max_length?: number;
    avg_length?: number;
  };
  externalDocumentUri?: string;
  markedForRegeneration?: boolean;
  isMarkingForRegeneration?: boolean;
  parentTableId?: string;
  isHtml?: boolean;
  currentColumn?: MetadataItem | null;
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
  | { type: 'SET_ITEMS'; payload: { items: MetadataItem[]; pageToken: string | null; totalCount: number } }
  | { type: 'APPEND_ITEMS'; payload: MetadataItem[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<MetadataItem> } }
  | { type: 'SET_CURRENT_INDEX'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: 'list' | 'review' }
  | { type: 'SET_HAS_LOADED'; payload: boolean };

const initialState: ReviewState = {
  items: [],
  pageToken: null,
  totalCount: 0,
  currentItemIndex: 0,
  viewMode: 'list',
  hasLoadedItems: false,
};

const reviewReducer = (state: ReviewState, action: ReviewAction): ReviewState => {
  switch (action.type) {
    case 'SET_ITEMS':
      return {
        ...state,
        items: action.payload.items,
        pageToken: action.payload.pageToken,
        totalCount: action.payload.totalCount,
      };
    case 'APPEND_ITEMS':
      return {
        ...state,
        items: [...state.items, ...action.payload],
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item => {
          if (item.id === action.payload.id) {
            const updates = action.payload.updates;
            return {
              ...item,
              ...updates,
              metadata: updates.metadata 
                ? { ...item.metadata, ...updates.metadata } 
                : item.metadata,
              currentColumn: updates.currentColumn !== undefined 
                ? updates.currentColumn 
                : item.currentColumn,
            };
          }
          return item;
        }),
      };
    case 'SET_CURRENT_INDEX':
      return {
        ...state,
        currentItemIndex: action.payload,
      };
    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload,
      };
    case 'SET_HAS_LOADED':
      return {
        ...state,
        hasLoadedItems: action.payload,
      };
    default:
      return state;
  }
};

const ReviewContext = createContext<{
  state: ReviewState;
  dispatch: React.Dispatch<ReviewAction>;
} | undefined>(undefined);

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

export type { ReviewState, ReviewAction }; 