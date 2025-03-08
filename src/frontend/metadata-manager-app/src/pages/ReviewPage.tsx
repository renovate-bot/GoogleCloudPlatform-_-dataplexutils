import React, { useState, useEffect, useRef, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import ViewListIcon from '@mui/icons-material/ViewList';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LaunchIcon from '@mui/icons-material/Launch';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { DatplexConfig } from '../App';
import { useCache } from '../contexts/CacheContext';
import { useReview, MetadataItem } from '../contexts/ReviewContext';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface Comment {
  id: string;
  text: string;
  type: string;
  timestamp: string;
}

interface EditorChangeHandler {
  (content: string): void;
}

interface ReviewPageProps {
  config: {
    project_id: string;
    llm_location: string;
    dataplex_location: string;
    dataset_id?: string;
    description_handling?: string;
    description_prefix?: string;
  };
}

const ReviewPage: React.FC<ReviewPageProps> = ({ config }) => {
  const { detailsCache, setDetailsCache, clearCache } = useCache();
  const { state, dispatch } = useReview();
  const { items = [], pageToken, totalCount, currentItemIndex, viewMode, hasLoadedItems } = state;

  const [editItem, setEditItem] = useState<MetadataItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'human' | 'negative'>('human');
  const [apiUrlBase, setApiUrlBase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRichText, setIsRichText] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const editorRef = useRef<any>(null);
  const [isAccepting, setIsAccepting] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [taggedColumns, setTaggedColumns] = useState<MetadataItem[]>([]);
  const [currentColumnIndex, setCurrentColumnIndex] = useState<number>(-1);
  const [isColumnView, setIsColumnView] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [itemToPreload, setItemToPreload] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' | 'info'; loading: boolean } | null>(null);

  // Initialize API URL
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    setApiUrlBase(apiUrl);
  }, []);

  // Sync column navigation state with current item
  useEffect(() => {
    if (viewMode === 'review' && items.length > 0 && currentItemIndex >= 0) {
      const currentItem = items[currentItemIndex];
      
      if (currentItem) {
        // If this is a table (not a column), ensure currentItemId is set to the table ID
        if (!currentItem.id.includes('#column.')) {
          const tableId = currentItem.id;
          
          console.log('Syncing currentItemId to table:', tableId);
          
          // Only update if different to avoid infinite loops
          if (currentItemId !== tableId) {
            setCurrentItemId(tableId);
          }
          
          // If cached details exist, ensure taggedColumns is populated
          if (detailsCache[tableId]?.columns) {
            const columnsWithMetadata = detailsCache[tableId].columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            
            // Only update if different to avoid infinite loops
            if (taggedColumns.length !== columnsWithMetadata.length) {
              console.log('Syncing taggedColumns:', columnsWithMetadata.length);
              setTaggedColumns(columnsWithMetadata);
            }
          }
        }
      }
    }
  }, [viewMode, items, currentItemIndex, detailsCache]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: ReactKeyboardEvent) => {
      if (viewMode === 'review') {
        if (event.key === 'ArrowRight' || event.key === 'j') {
          handleNext();
        } else if (event.key === 'ArrowLeft' || event.key === 'k') {
          handlePrevious();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress as unknown as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyPress as unknown as EventListener);
    };
  }, [viewMode, currentItemIndex, items.length]);

  // Add a useEffect to track state changes for debugging
  useEffect(() => {
    console.log('State change detected:', {
      viewMode,
      currentItemIndex,
      currentItemId,
      isColumnView: items[currentItemIndex]?.currentColumn ? true : false,
      taggedColumnsCount: taggedColumns.length,
      currentColumnIndex
    });
  }, [viewMode, currentItemIndex, currentItemId, items, taggedColumns, currentColumnIndex]);

  // Load items if not loaded
  useEffect(() => {
    if (apiUrlBase && config.project_id && !hasLoadedItems) {
      setIsLoading(true);
      fetchReviewItems().finally(() => {
        setIsLoading(false);
        dispatch({ type: 'SET_HAS_LOADED', payload: true });
      });
    }
  }, [apiUrlBase, config.project_id, hasLoadedItems]);

  // Add a scroll event handler effect
  useEffect(() => {
    const handleScroll = () => {
      if (viewMode === 'list' && listContainerRef.current) {
        const container = listContainerRef.current;
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        // Check if user has scrolled to near the bottom (within 300px)
        const isNearingBottom = scrollHeight - scrollTop - clientHeight < 300;
        
        // Only trigger preload when we first reach near the bottom
        if (isNearingBottom && !isNearBottom) {
          setIsNearBottom(true);
          
          // Find visible items and preload the next item after the last visible one
          // This is a simple implementation - in a real app, you might need 
          // more sophisticated intersection detection
          const visibleItems = items.slice(
            Math.max(0, currentItemIndex - 2),
            Math.min(items.length, currentItemIndex + 5)
          );
          
          if (visibleItems.length > 0) {
            const lastVisibleItemIndex = items.findIndex(item => 
              item.id === visibleItems[visibleItems.length - 1].id
            );
            
            if (lastVisibleItemIndex !== -1 && lastVisibleItemIndex < items.length - 1) {
              console.log('Preloading item after scrolling near bottom');
              // Just mark the item for preloading
              const nextIndex = lastVisibleItemIndex + 1;
              if (nextIndex < items.length) {
                const nextItem = items[nextIndex];
                // Only preload if not already in cache
                if (!detailsCache[nextItem.id]) {
                  // We'll mark this item for preloading
                  setItemToPreload(nextItem.id);
                }
              }
            }
          }
        } else if (!isNearingBottom && isNearBottom) {
          // Reset the flag when we're no longer near the bottom
          setIsNearBottom(false);
        }
      }
    };
    
    // Get the container element to attach the scroll event
    const container = listContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [viewMode, currentItemIndex, isNearBottom, items, detailsCache]);

  // Add an effect to handle preloading when itemToPreload changes
  useEffect(() => {
    if (itemToPreload && !detailsCache[itemToPreload]) {
        console.log('Preloading item from state:', itemToPreload);
        // This will be defined by the time this effect runs
        loadItemDetails(itemToPreload, false)
          .then(() => {
            console.log('Successfully preloaded item:', itemToPreload);
            setItemToPreload(null);
          })
          .catch(error => {
            console.error('Error preloading item:', error);
            setItemToPreload(null);
          });
    }
  }, [itemToPreload, detailsCache]);

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newMode: 'list' | 'review' | null) => {
    if (newMode) {
      dispatch({ type: 'SET_VIEW_MODE', payload: newMode });
      if (newMode === 'review' && items.length > 0) {
        // Only load details if not in cache
        if (!detailsCache[items[currentItemIndex].id]) {
          loadItemDetails(items[currentItemIndex].id);
          if (currentItemIndex < items.length - 1) {
            preloadNextItem(currentItemIndex);
          }
        }
      }
    }
  };

  // Update the handleRefresh function with detailed debugging
  const handleRefresh = async () => {
    console.log('🔍 REFRESH START - Current state:', {
      viewMode,
      currentItemId,
      currentColumnIndex,
      isColumnView,
      isRefreshing
    });
    
    try {
      if (viewMode === 'list') {
        // In list mode, just fetch the review items
        console.log('🔍 REFRESH - List mode, setting isRefreshing to true');
        setIsRefreshing(true);
        await fetchReviewItems();
        console.log('🔍 REFRESH - List mode completed, setting isRefreshing to false');
        setIsRefreshing(false);
      } else if (viewMode === 'review' && currentItemId) {
        // In review mode, show a notification but don't set isRefreshing
        // This prevents the screen from going blank
        console.log('🔍 REFRESH - Review mode, NOT setting isRefreshing');
        
        // Show notification
        setNotification({
          message: 'Refreshing metadata in background...',
          severity: 'info',
          loading: true
        });
        
        // Determine if we're viewing a column
        const currentItem = items[currentItemIndex];
        const isViewingColumn = Boolean(currentItem?.currentColumn) || currentItem?.type === 'column';
        
        console.log('🔍 REFRESH - Current view:', {
          isViewingColumn,
          currentItem: currentItem ? {
            id: currentItem.id,
            type: currentItem.type,
            hasCurrentColumn: Boolean(currentItem.currentColumn)
          } : null
        });
        
        console.log('🔍 REFRESH - Starting background refresh for:', currentItemId);
        
        // Extract the base table ID if this is a column
        const baseTableId = currentItemId.includes('#') ? currentItemId.split('#')[0] : currentItemId;
        const standardTableId = `${baseTableId}#table`;
        
        try {
          // Perform a background refresh without affecting navigation
          console.log('🔍 REFRESH - Calling backgroundRefreshWithoutNavigation for:', standardTableId);
          const result = await backgroundRefreshWithoutNavigation(standardTableId, isViewingColumn);
          console.log('🔍 REFRESH - Background refresh completed with result:', result);
          
          // Show success notification
          setNotification({
            message: 'Metadata refreshed successfully',
            severity: 'success',
            loading: false
          });
          
          // Clear notification after 3 seconds
          setTimeout(() => setNotification(null), 3000);
        } catch (error) {
          console.error('🔍 REFRESH - Error during background refresh:', error);
          
          // Show error notification
          setNotification({
            message: 'Failed to refresh metadata',
            severity: 'error',
            loading: false
          });
        }
      }
    } catch (error) {
      console.error('🔍 REFRESH - Error during refresh:', error);
    } finally {
      console.log('🔍 REFRESH END - Final state:', {
        viewMode,
        currentItemId,
        currentColumnIndex,
        isColumnView,
        isRefreshing
      });
    }
  };

  // Update the backgroundRefreshWithoutNavigation function with detailed debugging
  const backgroundRefreshWithoutNavigation = async (itemId: string, isViewingColumn = false) => {
    console.log('🔍 BACKGROUND REFRESH START - Current state:', {
      itemId,
        currentItemId,
        currentColumnIndex,
        isColumnView,
      viewMode,
      isRefreshing,
      isViewingColumn
    });
    
    // Store current state to restore later
    const currentState = {
      currentItemId,
      currentColumnIndex,
      isColumnView,
      viewMode,
      isViewingColumn
    };
    
    console.log('🔍 BACKGROUND REFRESH - Stored current state:', currentState);
    
    try {
      // Extract base table ID if this is a column
      const baseTableId = itemId.includes('#') ? itemId.split('#')[0] : itemId;
      const [projectId, datasetId, tableId] = baseTableId.split('.');
      
      // Standardize the table ID format
      const standardTableId = `${baseTableId}#table`;
      
      console.log('🔍 BACKGROUND REFRESH - Making API call for:', standardTableId);
      
      // Get fresh data
      const response = await axios.post(`${apiUrlBase}/metadata/review/details`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        table_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId,
        },
        column_settings: isViewingColumn ? {
          column_name: itemId.includes('#column.') ? itemId.split('#column.')[1] : undefined
        } : undefined
      });
      
      const details = response.data;
      console.log('🔍 BACKGROUND REFRESH - Received fresh data');
      
      // Create a new cache with the updated data
      const newCache = { ...detailsCache };
      
      // Get the current column data if needed
      let currentColumnData: MetadataItem | null = null;
      let currentColumnName: string | null = null;
      
      if (isColumnView && currentColumnIndex !== null && taggedColumns && taggedColumns.length > 0) {
        currentColumnData = taggedColumns[currentColumnIndex];
        if (currentColumnData) {
          currentColumnName = currentColumnData.name.split('.').pop() || null;
        }
      }
      
      console.log('🔍 BACKGROUND REFRESH - Current column data:', {
        isColumnView,
        currentColumnIndex,
        currentColumnName,
        hasCurrentColumnData: Boolean(currentColumnData)
      });
      
      // Update the table entry in the cache
      newCache[standardTableId] = {
        ...details,
        // CRITICAL: Preserve the current column if we're viewing this table and a column
        currentColumn: currentItemId === standardTableId && isColumnView && currentColumnData
          ? {...currentColumnData} // Create a new object to ensure React detects the change
          : null
      };
      
      console.log('🔍 BACKGROUND REFRESH - Updated table entry in cache');
      
      // Cache all columns from this table
      if (details.columns) {
        details.columns.forEach((col: any) => {
          const colName = col.name.split('.').pop();
          const columnId = `${standardTableId}#column.${colName}`;
          
          // If the column is already in the cache, preserve critical properties
          if (detailsCache[columnId]) {
            const preservedProps = {
              status: detailsCache[columnId].status,
              currentDescription: detailsCache[columnId].currentDescription,
              draftDescription: detailsCache[columnId].draftDescription,
              whenAccepted: detailsCache[columnId].whenAccepted
            };
            
            newCache[columnId] = {
              ...col,
              tableMarkedForRegeneration: details.markedForRegeneration || false,
              ...preservedProps
            };
          } else {
          newCache[columnId] = {
            ...col,
            tableMarkedForRegeneration: details.markedForRegeneration || false
          };
          }
        });
      }
      
      console.log('🔍 BACKGROUND REFRESH - Cached all columns');
      
      // Update the cache with the new data
      console.log('🔍 BACKGROUND REFRESH - Setting details cache');
      setDetailsCache(newCache);
      
      // Update the items array while preserving the current view
      const updatedItems = items.map(item => {
        if (item.id === standardTableId) {
          // Create a new item with the updated details
          const updatedItem = {
            ...item,
            ...details,
          };
          
          // CRITICAL: Preserve the column view state
          if (isColumnView && currentItemId === standardTableId && currentColumnData) {
            console.log('🔍 BACKGROUND REFRESH - Explicitly preserving column view state');
            updatedItem.currentColumn = {...currentColumnData}; // Create a new object to ensure React detects the change
            
            // If the current column is in the fresh data, update its metadata
            if (details.columns) {
              const columnName = currentColumnData.name.split('.').pop();
              const freshColumn = details.columns.find(col => 
                col.name.split('.').pop() === columnName
              );
              
              if (freshColumn) {
                // Preserve critical properties
                const preservedProps = {
                  status: currentColumnData.status,
                  currentDescription: currentColumnData.currentDescription,
                  draftDescription: currentColumnData.draftDescription,
                  whenAccepted: currentColumnData.whenAccepted
                };
                
                updatedItem.currentColumn = {
                  ...currentColumnData,
                  ...freshColumn,
                  ...preservedProps
                };
              }
            }
          } else if (item.currentColumn) {
            // If we're not in column view but the item has a current column, preserve it
            updatedItem.currentColumn = item.currentColumn;
          }
          
          return updatedItem;
        }
        return item;
      });
      
      console.log('🔍 BACKGROUND REFRESH - Prepared updated items');
      
      // Update items state
      console.log('🔍 BACKGROUND REFRESH - Dispatching SET_ITEMS');
          dispatch({
        type: 'SET_ITEMS',
            payload: {
          items: updatedItems,
          pageToken: state.pageToken,
          totalCount: state.totalCount
            }
          });
          
      // Extract tagged columns from the fresh data
      const freshTaggedColumns = details.columns?.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
      ) || [];
      
      console.log('🔍 BACKGROUND REFRESH - Extracted fresh tagged columns:', {
        count: freshTaggedColumns.length
      });
      
      // Only update tagged columns if we're viewing this table
      if (currentItemId === standardTableId) {
        console.log('🔍 BACKGROUND REFRESH - Updating tagged columns');
        
        // Update tagged columns
        setTaggedColumns(freshTaggedColumns);
        
        // If we're viewing a column, find its new index
        if (isColumnView && currentColumnIndex !== null && currentColumnName) {
          const freshColumnIndex = freshTaggedColumns.findIndex(col => 
            col.name.split('.').pop() === currentColumnName
          );
          
          console.log('🔍 BACKGROUND REFRESH - Column index:', {
            currentColumnIndex,
            freshColumnIndex,
            currentColumnName
          });
          
          // Only update the index if the column still exists and index changed
          if (freshColumnIndex !== -1 && freshColumnIndex !== currentColumnIndex) {
            console.log('🔍 BACKGROUND REFRESH - Setting new column index:', freshColumnIndex);
            setCurrentColumnIndex(freshColumnIndex);
          }
        }
      } else {
        console.log('🔍 BACKGROUND REFRESH - Not updating tagged columns, different table');
      }
      
      console.log('🔍 BACKGROUND REFRESH COMPLETED - Final state:', {
        currentItemId,
        currentColumnIndex,
        isColumnView,
        viewMode,
        isRefreshing
      });
      
      // CRITICAL: Make sure we stay in column view if we were in column view
      if ((isColumnView || isViewingColumn) && currentItemId === standardTableId) {
        console.log('🔍 BACKGROUND REFRESH - Ensuring column view is preserved');
        
        // Force a re-render of the column view by updating the column index
        if (currentColumnIndex !== null && currentColumnIndex >= 0) {
          // Re-set the current column index to force React to update
          setCurrentColumnIndex(currentColumnIndex);
        }
        
        // Make sure isColumnView is still true
        setIsColumnView(true);
      }
      
      return true;
    } catch (error) {
      console.error('🔍 BACKGROUND REFRESH - Error:', error);
      throw error;
    }
  };

  const handleViewDetails = async (itemId: string) => {
    // Find the index of the item
    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      setCurrentItemId(itemId);
      dispatch({ type: 'SET_CURRENT_INDEX', payload: itemIndex });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'review' });
      
      try {
        // Check if we have cached data
        if (detailsCache[itemId]) {
          console.log('Using cached item details:', detailsCache[itemId]);
          const cachedDetails = detailsCache[itemId];
          
          // Initialize column navigation state for tables
          if (!itemId.includes('#column.') && cachedDetails.columns) {
            const columnsWithMetadata = cachedDetails.columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            setTaggedColumns(columnsWithMetadata);
            setCurrentColumnIndex(-1);
          }
          
          // Ensure we're showing table details, not column
          dispatch({
            type: 'UPDATE_ITEM',
            payload: {
              id: itemId,
              updates: {
                ...cachedDetails,
                currentColumn: null // Ensure no column is selected
              }
            }
          });
        } else {
          // Load and cache the current item's details
          console.log('Loading item details for:', itemId);
          const details = await loadItemDetails(itemId);
          
          // Initialize column navigation state for tables when loading fresh data
          if (!itemId.includes('#column.') && details?.columns) {
            const columnsWithMetadata = details.columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            setTaggedColumns(columnsWithMetadata);
            setCurrentColumnIndex(-1);
          }
        }
        
        // Always try to preload the next item if it exists and isn't cached
        if (itemIndex < items.length - 1) {
          const nextItem = items[itemIndex + 1];
          if (!detailsCache[nextItem.id]) {
            console.log('Preloading next item:', nextItem.id);
            await preloadNextItem(itemIndex);
          }
        }
      } catch (error) {
        console.error('Error loading item details:', error);
        setError('Failed to load item details');
      }
    }
  };

  const handleAccept = async (item: MetadataItem) => {
    try {
      // Store current view state before making any changes
      const wasInColumnView = isColumnView;
      const previousColumnIndex = currentColumnIndex;
      const isViewingColumn = item.type === 'column' || Boolean(item.currentColumn);
      const currentlyViewedItemId = currentItemId;
      
      console.log('handleAccept - Starting with state:', {
        itemId: item.id,
        wasInColumnView,
        previousColumnIndex,
        isViewingColumn,
        itemType: item.type,
        currentlyViewedItemId
      });
      
      // Show notification
      setNotification({
        message: `Accepting ${isViewingColumn ? 'column' : 'table'} metadata...`,
        severity: 'info',
        loading: true
      });
      
      // Clear any existing accepting state first to ensure buttons work properly
      setIsAccepting({});
      
      // Then set accepting state for just this item
      setIsAccepting(prev => ({ ...prev, [item.id]: true }));
      
      setError(null);
      
      const tableFqn = item.id.split('#')[0];
      const [projectId, datasetId, tableId] = tableFqn.split('.');
      const isColumn = item.type === 'column' || isViewingColumn;
      const columnName = isColumn ? (item.id.includes('#column.') ? item.id.split('#column.')[1] : item.name.split('.').pop()) : undefined;
      
      console.log('handleAccept - Determined item details:', {
        isColumn,
        columnName,
        tableFqn
      });
      
      const endpoint = isColumn ? 'accept_column_draft_description' : 'accept_table_draft_description';
      
      await axios.post(`${apiUrlBase}/${endpoint}`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        client_options_settings: {
          use_lineage_tables: false,
          use_lineage_processes: false,
          use_profile: false,
          use_data_quality: false,
          use_ext_documents: false,
          persist_to_dataplex_catalog: true,
          stage_for_review: false,
          top_values_in_description: true,
          description_handling: config.description_handling || 'append',
          description_prefix: config.description_prefix || '---AI Generated description---'
        },
        table_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId,
          documentation_uri: item.metadata?.external_document_uri || item.externalDocumentUri || ""
        },
        dataset_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          documentation_csv_uri: "",
          strategy: "NAIVE"
        },
        column_settings: isColumn ? {
            column_name: columnName
        } : undefined,
        column_name: columnName
      });

      // Update both state and cache with the accepted status
      const updatedItem: Partial<MetadataItem> = {
        status: 'accepted' as const,
        currentDescription: item.draftDescription,
        whenAccepted: new Date().toISOString()
      };

      // Update the item in state without changing the current view
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: item.id, 
          updates: updatedItem
        }
      });

      // Update cache
      setDetailsCache(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          ...updatedItem
        }
      }));

      // Background refresh the item details without changing the current view
      if (viewMode === 'review') {
        try {
          // Only update the cache for the accepted item, don't change the current view
          const [itemProjectId, itemDatasetId, itemTableId] = tableFqn.split('.');
          const standardTableId = `${tableFqn}#table`;
          
          // Get fresh data for the item that was accepted
          const response = await axios.post(`${apiUrlBase}/metadata/review/details`, {
            client_settings: {
              project_id: config.project_id,
              llm_location: config.llm_location,
              dataplex_location: config.dataplex_location,
            },
            table_settings: {
              project_id: itemProjectId,
              dataset_id: itemDatasetId,
              table_id: itemTableId,
            },
            column_settings: isColumn ? {
              column_name: columnName
            } : undefined
          });
          
          const details = response.data;
          
          // Update the cache with the fresh data
          const newCache = { ...detailsCache };
          
          // Update the table entry in the cache
          newCache[standardTableId] = details;
          
          // Cache all columns from this table
          if (details.columns) {
            details.columns.forEach((col: any) => {
              const colName = col.name.split('.').pop();
              const columnId = `${standardTableId}#column.${colName}`;
              
              newCache[columnId] = {
                ...col,
                tableMarkedForRegeneration: details.markedForRegeneration || false
              };
            });
          }
          
          // Update the cache
          setDetailsCache(newCache);
          
          // Show success notification
          setNotification({
            message: 'Metadata accepted successfully',
            severity: 'success',
            loading: false
          });
          
          // Clear notification after 3 seconds
          setTimeout(() => setNotification(null), 3000);
        } catch (error) {
          console.error('Error refreshing item details after accept:', error);
          // Show error notification
          setNotification({
            message: 'Metadata accepted, but refresh failed',
            severity: 'error',
            loading: false
          });
          
          // Clear notification after 3 seconds
          setTimeout(() => setNotification(null), 3000);
        }
      }

    } catch (error: any) {
      console.error('API Error:', error);
      let errorMessage: string;
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'object'
          ? JSON.stringify(error.response.data.detail)
          : error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'An error occurred while accepting the draft';
      }
      setError(errorMessage);
      
      // Show error notification
      setNotification({
        message: 'Failed to accept metadata: ' + errorMessage,
        severity: 'error',
        loading: false
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } finally {
      // Clear accepting state after a short delay to ensure UI feedback
      setTimeout(() => {
        setIsAccepting(prev => ({ ...prev, [item.id]: false }));
      }, 500);
    }
  };

  const handleEdit = async (item: MetadataItem) => {
    const itemIndex = items.findIndex((i) => i.id === item.id);
    if (itemIndex !== -1) {
      dispatch({ type: 'SET_CURRENT_INDEX', payload: itemIndex });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'review' });
      await loadItemDetails(item.id);
      
      // Preload the next item if there is one
      if (itemIndex < items.length - 1) {
        preloadNextItem(itemIndex);
      }
    }
  };

  // Separate handler for editing in review mode
  const handleEditInReview = (item: MetadataItem) => {
    // Ensure we're editing the correct item (table or column)
    setEditItem({
      ...item,
      type: item.type, // Preserve the type (table or column)
      id: item.id // Preserve the full ID which includes column info if it's a column
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editItem) {
    try {
      setError(null);
      
      const tableFqn = editItem.id.split('#')[0];
      const [projectId, datasetId, tableId] = tableFqn.split('.');
        const isColumn = editItem.type === 'column';
      const columnName = isColumn ? editItem.id.split('#column.')[1] : undefined;
      
      const endpoint = isColumn ? 'update_column_draft_description' : 'update_table_draft_description';
      
        await axios.post(`${apiUrlBase}/${endpoint}`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        table_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId,
          documentation_uri: editItem.metadata?.external_document_uri || editItem.externalDocumentUri || ""
        },
        description: editItem.draftDescription,
        is_html: isRichText,
        column_name: columnName
      });
      
        // Update both state and cache with the new description
        const updatedItem = {
          ...editItem,
          draftDescription: editItem.draftDescription,
          lastModified: new Date().toISOString()
        };

      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: editItem.id,
            updates: updatedItem
        }
      });
      
        // Update cache
      setDetailsCache(prev => ({
        ...prev,
        [editItem.id]: {
          ...prev[editItem.id],
            ...updatedItem
        }
      }));
      
      setEditDialogOpen(false);
      setEditItem(null);
      
        // Refresh the item details to get the updated state
        await loadItemDetails(editItem.id, true);
      } catch (err) {
        setError('Failed to save changes. Please try again.');
        console.error('Error saving description:', err);
      }
    }
  };

  const handleAddComment = async (itemId: string) => {
    try {
      setError(null);
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const tableFqn = item.id.split('#')[0];
      const [projectId, datasetId, tableId] = tableFqn.split('.');
      const isColumn = item.id.includes('#column.');
      const columnName = isColumn ? item.id.split('#column.')[1] : undefined;

      await axios.post(`${apiUrlBase}/metadata/review/add_comment`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        table_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId,
        },
        column_settings: isColumn ? {
          column_name: columnName
        } : undefined,
        comment: newComment,
        column_name: columnName,
        is_column_comment: isColumn
      });

      // Update the comments in the state
      const updatedItem = {
        ...item,
        comments: [...(item.comments || []), newComment]
      };

      dispatch({
        type: 'UPDATE_ITEM',
        payload: { 
          id: itemId, 
          updates: updatedItem
        }
      });

      // Update the cache
      if (isColumn) {
        setDetailsCache(prev => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            comments: updatedItem.comments
          }
        }));
      }

      setNewComment('');

    } catch (error: any) {
      console.error('Error adding comment:', error);
      setError(error.response?.data?.detail || 'Failed to add comment');
    }
  };

  const handleMarkForRegeneration = async (itemId: string) => {
    try {
      console.log('Marking for regeneration:', itemId);
      
      // For columns, we need to handle the case where the column might not be in the items array
      let item: MetadataItem | undefined;
      let isColumn = false;
      let columnName: string | undefined;
      let tableFqn: string;
      let tableId: string;
      
      if (itemId.includes('#column.')) {
        isColumn = true;
        // Extract the table FQN and column name
        const parts = itemId.split('#column.');
        // Remove #table suffix if present
        tableFqn = parts[0].replace('#table', '');
        tableId = parts[0]; // Keep the original table ID with #table suffix
        columnName = parts[1];
        
        console.log('Extracted column info:', { tableFqn, columnName, tableId });
        
        // Find the parent table item
        const tableItem = items.find(i => i.id === tableId);
        if (!tableItem) {
          throw new Error('Parent table not found');
        }
        
        // For columns, we might need to construct a temporary item
        if (tableItem.currentColumn && tableItem.currentColumn.id === itemId) {
          // Use the current column if it matches
          item = {
            ...tableItem.currentColumn,
            id: itemId,
            type: 'column'
          };
        } else {
          // Try to find the column in the table's tagged columns
          const column = taggedColumns.find(c => c.name.endsWith(`.${columnName}`));
          if (column) {
            item = {
              ...column,
              id: itemId,
              type: 'column',
              status: 'draft',
              lastModified: new Date().toISOString()
            };
          }
        }
        
        // If we still don't have an item, create a minimal one
        if (!item) {
          item = {
            id: itemId,
            type: 'column',
            name: columnName,
            isMarkingForRegeneration: false,
            status: 'draft',
            lastModified: new Date().toISOString()
          };
        }
        
        // Set loading state for the column
        // First, update the column's loading state
        dispatch({
          type: 'UPDATE_ITEM',
          payload: { id: itemId, updates: { isMarkingForRegeneration: true } }
        });
        
        // Then, update the column within the parent table
        if (tableItem.currentColumn) {
          const updatedTable = {
            ...tableItem,
            currentColumn: {
              ...tableItem.currentColumn,
              isMarkingForRegeneration: true
            }
          };
          
          dispatch({
            type: 'UPDATE_ITEM',
            payload: { id: tableId, updates: updatedTable }
          });
        }
      } else {
        // For tables, use the existing logic but remove #table suffix if present
        tableFqn = itemId.replace('#table', '');
        tableId = itemId;
        console.log('Extracted table FQN:', tableFqn);
        
        item = items.find(i => i.id === itemId);
        if (!item) throw new Error('Item not found');
        
        // Set loading state for the table
        dispatch({
          type: 'UPDATE_ITEM',
          payload: { id: itemId, updates: { isMarkingForRegeneration: true } }
        });
      }

      // Make the API call
      console.log('Making API call with:', { tableFqn, columnName });
      const response = await axios.post(`${apiUrlBase}/mark_for_regeneration`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        request: {
          table_fqn: tableFqn,
          column_name: columnName
        },
        column_settings: isColumn ? {
          column_name: columnName
        } : undefined
      });

      console.log('Mark for regeneration response:', response.data);

      // Clear the cache for this item to ensure we get fresh data next time it's loaded
      // but don't trigger a refresh now (it takes too long)
            setDetailsCache(prev => ({
              ...prev,
        [itemId]: undefined
      }));

      // Instead of refreshing the item details, just update the UI state
      // This avoids the long wait for regeneration
      if (isColumn) {
        // For columns, update both the column and the parent table UI
          dispatch({
            type: 'UPDATE_ITEM',
            payload: { 
            id: itemId, 
              updates: { 
                markedForRegeneration: true,
                isMarkingForRegeneration: false
              } 
            }
        });
        
        // Update the column within the parent table
        const tableItem = items.find(i => i.id === tableId);
          if (tableItem && tableItem.currentColumn) {
            const updatedTable = {
              ...tableItem,
              currentColumn: {
                ...tableItem.currentColumn,
                markedForRegeneration: true,
                isMarkingForRegeneration: false
              }
            };
            
            dispatch({
              type: 'UPDATE_ITEM',
            payload: { id: tableId, updates: updatedTable }
            });
          }
      } else {
        // For tables, just update the table UI state without full refresh
          dispatch({
            type: 'UPDATE_ITEM',
            payload: { 
            id: itemId, 
              updates: { 
                markedForRegeneration: true,
                isMarkingForRegeneration: false
              } 
            }
          });
        
        // Also update the in-memory cache to reflect this change
        if (detailsCache[itemId]) {
          const updatedCache = {
            ...detailsCache,
            [itemId]: {
              ...detailsCache[itemId],
              markedForRegeneration: true,
              isMarkingForRegeneration: false
            }
          };
          setDetailsCache(updatedCache);
        }
      }

      setError(null);
    } catch (error: any) {
      console.error('Error marking for regeneration:', error);
      
      // Reset loading state on error
      if (itemId.includes('#column.')) {
        // For columns, reset both the column and the parent table
        const tableId = itemId.split('#column.')[0];
        
          dispatch({
            type: 'UPDATE_ITEM',
          payload: { id: itemId, updates: { isMarkingForRegeneration: false } }
        });
        
        // Reset the column within the parent table
        const tableItem = items.find(i => i.id === tableId);
          if (tableItem && tableItem.currentColumn) {
            const updatedTable = {
              ...tableItem,
              currentColumn: {
                ...tableItem.currentColumn,
                isMarkingForRegeneration: false
              }
            };
            
            dispatch({
              type: 'UPDATE_ITEM',
            payload: { id: tableId, updates: updatedTable }
            });
          }
      } else {
        // For tables, just reset the table
          dispatch({
            type: 'UPDATE_ITEM',
          payload: { id: itemId, updates: { isMarkingForRegeneration: false } }
        });
      }
      
      setError(error.message || 'Failed to mark for regeneration');
    }
  };

  const handleNext = () => {
    if (currentItemIndex < items.length - 1) {
      const nextItem = items[currentItemIndex + 1];
      
      // If moving to a table, load its columns
      if (nextItem.type === 'table') {
        setCurrentItemId(nextItem.id);
        // Let loadItemDetails handle setting up the column state
      } else {
        // If moving to a column, ensure it belongs to the current table
        const tableId = nextItem.id.split('#')[0];
        if (tableId !== currentItemId) {
          // Moving to a column of a different table
          setCurrentItemId(tableId);
        }
      }
      
      dispatch({ type: 'SET_CURRENT_INDEX', payload: currentItemIndex + 1 });
      loadItemDetails(nextItem.id);
    }
  };

  const handlePrevious = () => {
    if (currentItemIndex > 0) {
      const prevItem = items[currentItemIndex - 1];
      
      // If moving to a table, load its columns
      if (prevItem.type === 'table') {
        setCurrentItemId(prevItem.id);
        // Let loadItemDetails handle setting up the column state
      } else {
        // If moving to a column, ensure it belongs to the current table
        const tableId = prevItem.id.split('#')[0];
        if (tableId !== currentItemId) {
          // Moving to a column of a different table
          setCurrentItemId(tableId);
        }
      }
      
      dispatch({ type: 'SET_CURRENT_INDEX', payload: currentItemIndex - 1 });
      
      // Only load details if not already in cache
      if (!detailsCache[prevItem.id]) {
        console.log('Loading details for previous item:', prevItem.id);
      loadItemDetails(prevItem.id);
      } else {
        console.log('Using cached data for previous item:', prevItem.id);
        const cachedDetails = detailsCache[prevItem.id];
        
        // For columns, handle column-specific logic
        if (prevItem.id.includes('#column.')) {
          const columnDetails = {
            ...cachedDetails,
            id: prevItem.id,
            type: 'column',
            comments: cachedDetails.comments || [],
            currentDescription: cachedDetails.currentDescription || '',
            draftDescription: cachedDetails.draftDescription || '',
            status: cachedDetails.status || 'draft'
          };
          
          dispatch({
            type: 'UPDATE_ITEM',
            payload: {
              id: prevItem.id,
              updates: columnDetails
            }
          });
          
          // Update column navigation state
          const tableId = prevItem.id.split('#')[0];
          if (detailsCache[tableId]?.columns) {
            const columnsWithMetadata = detailsCache[tableId].columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            setTaggedColumns(columnsWithMetadata);
            const columnName = prevItem.id.split('#column.')[1];
            const columnIndex = columnsWithMetadata.findIndex(col => col.name.endsWith(columnName));
            if (columnIndex !== -1) {
              setCurrentColumnIndex(columnIndex);
            }
          }
        } else {
          // For tables, update table details and column navigation state
          const updatedDetails = { ...cachedDetails, currentColumn: null };
          
          dispatch({
            type: 'UPDATE_ITEM',
            payload: {
              id: prevItem.id,
              updates: updatedDetails
            }
          });
          
          // Update column navigation state for tables
          if (cachedDetails.columns) {
            const columnsWithMetadata = cachedDetails.columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            setTaggedColumns(columnsWithMetadata);
            setCurrentColumnIndex(-1);
          }
        }
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const truncateHtml = (html: string, maxLength: number = 150) => {
    // Remove HTML tags for length calculation
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    
    if (text.length <= maxLength) return html;
    
    // Truncate text and add ellipsis
    const truncated = text.slice(0, maxLength) + '...';
    return `<div>${truncated}</div>`;
  };

  const renderDescription = (description: string, isHtml: boolean, truncate: boolean = false) => {
    if (!description) return null;
    
    const content = truncate ? truncateHtml(description) : description;
    
    return (
      <Box 
        dangerouslySetInnerHTML={{ __html: content }}
        sx={{ 
          '& p': { margin: '0.5em 0' },
          '& ul, & ol': { marginLeft: '1.5em' },
          '& a': { color: 'primary.main' },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(truncate && {
            maxHeight: '100px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          })
        }}
      />
    );
  };

  const renderDescriptionWithDiff = (currentDescription: string, draftDescription: string, isHtml: boolean) => {
    // Strip HTML tags if the content is HTML
    const stripHtml = (html: string) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    };

    const oldText = isHtml ? stripHtml(currentDescription || '') : currentDescription || '';
    const newText = isHtml ? stripHtml(draftDescription || '') : draftDescription || '';

    // If there are no changes, show a message indicating this
    const hasChanges = oldText !== newText;

    return (
      <Box>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showDiff}
                  onChange={(e) => setShowDiff(e.target.checked)}
                />
              }
              label={showDiff ? "Showing Diff View" : "Showing Side by Side"}
            />
            {!hasChanges && (
              <Typography variant="subtitle1" color="text.secondary">
                No changes detected between current and draft versions
              </Typography>
            )}
          </Box>
          {hasChanges && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This item has draft changes that need review
            </Alert>
          )}
        </Box>
        
        {showDiff ? (
          <Box sx={{ 
            minHeight: '400px',
            '& .diff-viewer': {
              width: '100%',
              minHeight: '400px'
            },
            '& .diff-container': {
              margin: 0,
              padding: '16px'
            },
            '& .diff-title-header': {
              padding: '8px 16px',
              background: '#f5f5f5',
            }
          }}>
            <ReactDiffViewer
              oldValue={oldText}
              newValue={newText}
              splitView={true}
              leftTitle="Current Version"
              rightTitle="Draft Version"
              compareMethod={DiffMethod.WORDS}
              styles={{
                variables: {
                  light: {
                    diffViewerBackground: '#f8f9fa',
                    diffViewerColor: '#212529',
                    addedBackground: '#e6ffec',
                    addedColor: '#24292f',
                    removedBackground: '#ffebe9',
                    removedColor: '#24292f',
                    wordAddedBackground: '#abf2bc',
                    wordRemovedBackground: '#fdb8c0',
                  }
                }
              }}
            />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>Current Version</Typography>
              <Paper sx={{ p: 2, minHeight: '200px' }}>
                {isHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: currentDescription || 'No description available' }} />
                ) : (
                  <Typography>{currentDescription || 'No description available'}</Typography>
                )}
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>Draft Version</Typography>
              <Paper sx={{ p: 2, minHeight: '200px', bgcolor: hasChanges ? 'rgba(200, 250, 205, 0.15)' : undefined }}>
                {isHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: draftDescription || 'No draft description available' }} />
                ) : (
                  <Typography>{draftDescription || 'No draft description available'}</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>
    );
  };

  const renderComments = (comments: string[] = []) => (
    <List>
      {comments.map((comment, index) => (
        <React.Fragment key={index}>
          <ListItem>
            <ListItemText primary={comment} />
          </ListItem>
          {index < comments.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );

  const renderListMode = () => (
    <Box ref={listContainerRef} sx={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Tagged Columns</TableCell>
              <TableCell>Regeneration</TableCell>
              <TableCell>Last Modified</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const itemDetails = detailsCache[item.id];
              const taggedColumnsCount = itemDetails?.columns?.filter((col: any) => 
                col.tags && Object.keys(col.tags).length > 0 && 
                col.tags.some((tag: any) => tag.description && tag.description.trim() !== '')
              )?.length || 0;

              return (
                <TableRow
                  key={item.id}
                  onClick={() => handleViewDetails(item.id)}
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      cursor: 'pointer'
                    }
                  }}
                >
                  <TableCell component="th" scope="row">
                    {item.name}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      size="small"
                      color={item.type === 'table' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      size="small"
                      color={getStatusColor(item.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {item.tags && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(item.tags).map(([tag, value]) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.type === 'table' && taggedColumnsCount > 0 && (
                      <Chip
                        label={`${taggedColumnsCount} tagged columns`}
                        size="small"
                        color="info"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkForRegeneration(item.id);
                        }}
                        size="small"
                        disabled={(() => {
                          const isDisabled = item.markedForRegeneration || item.isMarkingForRegeneration;
                          console.log('Regeneration Button Debug:', {
                            itemId: item.id,
                            markedForRegeneration: item.markedForRegeneration,
                            isMarkingForRegeneration: item.isMarkingForRegeneration,
                            isDisabled,
                            currentItem: {
                              id: item.id,
                              type: item.type,
                              name: item.name,
                              status: item.status
                            }
                          });
                          return isDisabled;
                        })()}
                      >
                        <AutorenewIcon sx={{ 
                          animation: item.isMarkingForRegeneration ? 'spin 1s linear infinite' : 'none',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                          }
                        }} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>{item.lastModified}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(item.id);
                        }}
                        size="small"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderActionBar = (currentItem: MetadataItem) => {
    // Determine if we're viewing a column more accurately
    const isViewingColumn = Boolean(currentItem.currentColumn) || currentItem.type === 'column';
    const isViewingTable = !isViewingColumn;
    
    // Check if the current table has tagged columns
    const hasTaggedColumns = taggedColumns.length > 0;
    
    // Debug information for regeneration button
    console.group('Regeneration Button Debug - Review Mode');
    console.log('Current Item:', {
      id: currentItem.id,
      type: currentItem.type,
      name: currentItem.name,
      markedForRegeneration: currentItem.markedForRegeneration,
      isMarkingForRegeneration: currentItem.isMarkingForRegeneration,
      currentColumn: currentItem.currentColumn ? {
        id: currentItem.currentColumn.id,
        name: currentItem.currentColumn.name,
        markedForRegeneration: currentItem.currentColumn.markedForRegeneration,
        isMarkingForRegeneration: currentItem.currentColumn.isMarkingForRegeneration
      } : null
    });
    
    // Calculate disabled state based on whether we're viewing a table or a column
    let isDisabled;
    
    // Determine the effective type for the current view
    const effectiveType = isViewingColumn ? 'column' : 'table';
    
    if (currentItem.type === 'column') {
      // For columns, only disable if this specific column is marked or marking
      isDisabled = currentItem.markedForRegeneration || currentItem.isMarkingForRegeneration;
    } else if (currentItem.currentColumn) {
      // For columns viewed within a table, use the column's status
      isDisabled = currentItem.currentColumn.markedForRegeneration || currentItem.currentColumn.isMarkingForRegeneration;
    } else {
      // For tables, disable if the table is marked or marking
      isDisabled = currentItem.markedForRegeneration || currentItem.isMarkingForRegeneration;
    }
    
    console.log('Button State:', {
      isDisabled,
      type: effectiveType, // Use the effective type instead of currentItem.type
      hasCurrentColumn: Boolean(currentItem.currentColumn),
      markedForRegeneration: currentItem.markedForRegeneration,
      isMarkingForRegeneration: currentItem.isMarkingForRegeneration,
      columnMarkedForRegeneration: currentItem.currentColumn?.markedForRegeneration,
      columnIsMarkingForRegeneration: currentItem.currentColumn?.isMarkingForRegeneration
    });
    console.groupEnd();
    
    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left side - Edit and Accept buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleEditInReview(currentItem)}
            startIcon={<EditIcon />}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleAccept(currentItem)}
            startIcon={<CheckCircleIcon />}
            disabled={!currentItem.draftDescription || isAccepting[currentItem.id]}
          >
            {isAccepting[currentItem.id] ? 'Accepting...' : 'Accept'}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              // When viewing a column within a table, use the column's ID
              if (currentItem.currentColumn) {
                handleMarkForRegeneration(currentItem.currentColumn.id);
              } else {
                handleMarkForRegeneration(currentItem.id);
              }
            }}
            startIcon={
              <AutorenewIcon sx={{ 
                animation: currentItem.isMarkingForRegeneration || 
                           (currentItem.currentColumn && currentItem.currentColumn.isMarkingForRegeneration) 
                           ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            }
            disabled={isDisabled}
          >
            {currentItem.isMarkingForRegeneration || 
             (currentItem.currentColumn && currentItem.currentColumn.isMarkingForRegeneration) 
             ? 'Marking...' : 'Mark for Regeneration'}
          </Button>
          {/* Debug button - kept for development purposes */}
          <Button
            variant="outlined"
            color="info"
            onClick={logDebugInfo}
            size="small"
            sx={{ ml: 1 }}
          >
            Debug
          </Button>
        </Box>

        {/* Right side - Navigation buttons */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Previous button */}
          <Button
            variant="outlined"
            onClick={handlePrevious}
            disabled={currentItemIndex === 0}
            startIcon={<NavigateBeforeIcon />}
          >
            Previous
          </Button>

          {/* Column navigation buttons */}
          <Box sx={{ display: 'flex', gap: 1, mx: 2 }}>
            <Button
              variant={hasTaggedColumns ? "contained" : "outlined"}
              color="info"
              onClick={handlePrevColumn}
              disabled={!hasTaggedColumns || currentColumnIndex <= 0}
              startIcon={<NavigateBeforeIcon />}
              sx={{ minWidth: '120px' }}
            >
              Prev Column
            </Button>
            <Button
              variant={isViewingColumn ? "contained" : "outlined"}
              color="info"
              onClick={handleBackToTable}
              disabled={!isViewingColumn}
              sx={{ minWidth: '80px' }}
            >
              Table
            </Button>
            <Button
              variant={hasTaggedColumns ? "contained" : "outlined"}
              color="info"
              onClick={handleNextColumn}
              disabled={!hasTaggedColumns || currentColumnIndex >= taggedColumns.length - 1}
              endIcon={<NavigateNextIcon />}
              sx={{ minWidth: '120px' }}
            >
              Next Column
            </Button>
          </Box>

          {/* Next button */}
          <Button
            variant="outlined"
            onClick={handleNext}
            disabled={currentItemIndex === items.length - 1}
            endIcon={<NavigateNextIcon />}
          >
            Next
          </Button>
        </Box>
      </Box>
    );
  };

  const handleNextColumn = () => {
    // Clear accepting state to ensure Accept buttons work after navigation
    setIsAccepting({});
      
    // Defensive checks with detailed logging
    if (!currentItemId) {
      console.log('Cannot navigate: currentItemId is not set');
        return;
      }
      
    if (taggedColumns.length === 0) {
      console.log('Cannot navigate: no tagged columns available');
        return;
      }
      
    if (currentColumnIndex >= taggedColumns.length - 1) {
      console.log('Cannot navigate: already at the last column', currentColumnIndex, taggedColumns.length);
        return;
      }
      
    // Get the current table ID, whether we're viewing a table or a column
    const currentItem = items[currentItemIndex];
    const tableId = currentItem.type === 'table' ? currentItem.id : currentItem.id.split('#')[0];
    
    // Ensure we're working with the correct table
    if (tableId !== currentItemId) {
      console.log('Table ID mismatch - updating currentItemId:', tableId, 'was:', currentItemId);
      // Force update the currentItemId to match the current table
      setCurrentItemId(tableId);
    }

    // Always use the next index rather than relying on the current state
    const nextColumnIndex = currentColumnIndex + 1;
    const nextColumn = taggedColumns[nextColumnIndex];
    
    if (!nextColumn) {
      console.log('No next column found at index:', nextColumnIndex);
        return;
      }
      
    const nextColumnId = `${tableId}#column.${nextColumn.name.split('.').pop()}`;
    console.log('Navigating to next column:', nextColumnId, 'index:', nextColumnIndex);
    
    // Create a temporary column item for display
    const columnItem: MetadataItem = {
      id: nextColumnId,
      type: 'column',
          name: nextColumn.name,
      status: nextColumn.status || 'draft',
      currentDescription: nextColumn.currentDescription || '',
      draftDescription: nextColumn.draftDescription || '',
      comments: nextColumn.comments || [],
      parentTableId: tableId,
      lastModified: new Date().toISOString(),
      isHtml: false,
      markedForRegeneration: nextColumn.markedForRegeneration || false,
      isMarkingForRegeneration: nextColumn.isMarkingForRegeneration || false
    };
    
    // Update column index
    setCurrentColumnIndex(nextColumnIndex);
    
    // Use cached data if available
    if (detailsCache[nextColumnId]) {
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
          id: tableId, // Update the current table item
          updates: {
            currentColumn: columnItem
          }
        }
      });
      
      // Also update the column's data separately
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
          id: nextColumnId,
          updates: detailsCache[nextColumnId]
        }
      });
    } else {
      loadItemDetails(nextColumnId);
    }
  };

  const handlePrevColumn = () => {
    // Clear accepting state to ensure Accept buttons work after navigation
    setIsAccepting({});
      
    // Defensive checks with detailed logging
    if (!currentItemId) {
      console.log('Cannot navigate: currentItemId is not set');
        return;
      }
      
    if (taggedColumns.length === 0) {
      console.log('Cannot navigate: no tagged columns available');
        return;
      }
      
    if (currentColumnIndex <= 0) {
      console.log('Cannot navigate: already at the first column', currentColumnIndex);
        return;
      }
      
    // Get the current table ID, whether we're viewing a table or a column
    const currentItem = items[currentItemIndex];
    const tableId = currentItem.type === 'table' ? currentItem.id : currentItem.id.split('#')[0];
    
    // Ensure we're working with the correct table
    if (tableId !== currentItemId) {
      console.log('Table ID mismatch - updating currentItemId:', tableId, 'was:', currentItemId);
      // Force update the currentItemId to match the current table
      setCurrentItemId(tableId);
    }

    // Always use the previous index rather than relying on the current state
    const prevColumnIndex = currentColumnIndex - 1;
    const prevColumn = taggedColumns[prevColumnIndex];
    
    if (!prevColumn) {
      console.log('No previous column found at index:', prevColumnIndex);
        return;
      }
      
    const prevColumnId = `${tableId}#column.${prevColumn.name.split('.').pop()}`;
    console.log('Navigating to previous column:', prevColumnId, 'index:', prevColumnIndex);
    
    // Create a temporary column item for display
    const columnItem: MetadataItem = {
      id: prevColumnId,
      type: 'column',
          name: prevColumn.name,
      status: prevColumn.status || 'draft',
      currentDescription: prevColumn.currentDescription || '',
      draftDescription: prevColumn.draftDescription || '',
      comments: prevColumn.comments || [],
      parentTableId: tableId,
      lastModified: new Date().toISOString(),
      isHtml: false,
      markedForRegeneration: prevColumn.markedForRegeneration || false,
      isMarkingForRegeneration: prevColumn.isMarkingForRegeneration || false
    };
    
    // Update column index
    setCurrentColumnIndex(prevColumnIndex);
    
    // Use cached data if available
    if (detailsCache[prevColumnId]) {
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
          id: tableId, // Update the current table item
          updates: {
            currentColumn: columnItem
          }
        }
      });
      
      // Also update the column's data separately
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
          id: prevColumnId,
          updates: detailsCache[prevColumnId]
        }
      });
    } else {
      loadItemDetails(prevColumnId);
    }
  };

  const handleBackToTable = async () => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) {
      console.log('Cannot go back to table: no current item');
      return;
    }
    
    if (!currentItem.currentColumn) {
      console.log('Already in table view');
      return;
    }
    
    // Get the table ID from the current item
    const tableId = currentItem.id;
    
    console.log('Going back to table:', tableId, 'from column:', currentItem.currentColumn.id);
    
    try {
      // Set loading state to provide visual feedback
      setIsLoadingDetails(true);
    
      // Reset column index
    setCurrentColumnIndex(-1);
    
      // Ensure currentItemId is set to the table ID
      setCurrentItemId(tableId);
      
      // Create a clean copy of the current item without the column data
      const tableItem = {
        ...currentItem,
        currentColumn: null
      };
      
      // Update the state to show the table instead of the column
    dispatch({
      type: 'UPDATE_ITEM',
      payload: {
        id: tableId,
          updates: tableItem
        }
      });
      
      // Log for debugging
      console.log('Back to table view complete - updated state:', {
        tableId,
        hasCurrentColumn: Boolean(tableItem.currentColumn),
        taggedColumnsCount: taggedColumns.length
      });
    } catch (error) {
      console.error('Error going back to table:', error);
      setError('Failed to go back to table view. Please try again.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const loadItemDetails = async (itemId: string, forceRefresh = false) => {
    try {
        setIsLoadingDetails(true);
      setError(null);

      // Store current view state before making any changes
      const wasInColumnView = isColumnView;
      const previousColumnIndex = currentColumnIndex;
      const previousItemId = currentItemId;
      
      console.log('loadItemDetails - Starting with state:', {
        itemId,
        forceRefresh,
        wasInColumnView,
        previousColumnIndex,
        previousItemId
      });

      // Use cache if available and not forcing refresh
      if (!forceRefresh && detailsCache[itemId]) {
        console.log('Using cached item details:', itemId);
        const cachedDetails = detailsCache[itemId];

        if (itemId.includes('#column.')) {
          const columnName = itemId.split('#column.')[1];
          const itemDetails = cachedDetails.columns?.find((col: any) => col.name.endsWith(columnName));
          if (!itemDetails) {
            throw new Error(`Column ${columnName} not found in table details`);
          }
          // When viewing a column, we should still maintain the tagged columns list
          if (cachedDetails.columns) {
            const columnsWithMetadata = cachedDetails.columns.filter((col: any) => 
              col.draftDescription || col.currentDescription || 
              (col.metadata && Object.keys(col.metadata).length > 0)
            );
            console.log('Found columns with metadata:', columnsWithMetadata.length);
            setTaggedColumns(columnsWithMetadata);
            // Set the current column index based on the loaded column
            const columnIndex = columnsWithMetadata.findIndex(col => col.name.endsWith(columnName));
            if (columnIndex !== -1) {
              setCurrentColumnIndex(columnIndex);
            }
          }
          
          // Ensure regeneration status is properly set for columns
          const updatedDetails = {
                ...itemDetails,
                markedForRegeneration: itemDetails.markedForRegeneration || false,
                isMarkingForRegeneration: itemDetails.isMarkingForRegeneration || false,
            // Ensure we're not inheriting the table's regeneration status
                tableMarkedForRegeneration: cachedDetails.markedForRegeneration || false
          };
          
          dispatch({
            type: 'UPDATE_ITEM',
            payload: {
              id: itemId,
              updates: updatedDetails
            }
          });
          
          return updatedDetails;
        }

        // For table details: reinitialize column navigation state and clear any active column
        if (cachedDetails.columns) {
          const columnsWithMetadata = cachedDetails.columns.filter((col: any) => 
            col.draftDescription || col.currentDescription || 
            (col.metadata && Object.keys(col.metadata).length > 0)
          );
          setTaggedColumns(columnsWithMetadata);
          setCurrentColumnIndex(-1);
          setCurrentItemId(itemId);
        }

        // Clear any active column for table details
        const updatedDetails = { ...cachedDetails, currentColumn: null };
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: itemId,
            updates: updatedDetails
          }
        });
        // Also update the cache with the cleared currentColumn
        setDetailsCache(prev => ({ ...prev, [itemId]: updatedDetails }));
        return updatedDetails;
      }

      const [projectId, datasetId, tableId] = itemId.split('#')[0].split('.');
      const isColumn = itemId.includes('#column.');

      console.log('Fetching details for item:', itemId);
      const response = await axios.post(`${apiUrlBase}/metadata/review/details`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        table_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          table_id: tableId,
        },
        column_settings: isColumn ? {
          column_name: itemId.split('#column.')[1]
        } : undefined
      });

      const details = response.data;
      console.log('Received item details:', details);

      // If this is a column request, find the column details in the table response
      let itemDetails;
      if (isColumn) {
        const columnName = itemId.split('#column.')[1];
        itemDetails = details.columns?.find((col: any) => col.name.endsWith(columnName));
        if (!itemDetails) {
          throw new Error(`Column ${columnName} not found in table details`);
        }
        // When viewing a column, we should still maintain the tagged columns list
        if (details.columns) {
          const columnsWithMetadata = details.columns.filter((col: any) => 
            col.draftDescription || col.currentDescription || 
            (col.metadata && Object.keys(col.metadata).length > 0)
          );
          console.log('Found columns with metadata:', columnsWithMetadata.length);
          setTaggedColumns(columnsWithMetadata);
          // Set the current column index based on the loaded column
          const columnIndex = columnsWithMetadata.findIndex(col => col.name.endsWith(columnName));
          if (columnIndex !== -1) {
            setCurrentColumnIndex(columnIndex);
          }
        }

        // Ensure regeneration status is properly set for columns
        const updatedDetails = {
          ...itemDetails,
          markedForRegeneration: itemDetails.markedForRegeneration || false,
          isMarkingForRegeneration: itemDetails.isMarkingForRegeneration || false,
          // Ensure we're not inheriting the table's regeneration status
          tableMarkedForRegeneration: details.markedForRegeneration || false
        };
        
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: itemId,
            updates: updatedDetails
          }
        });
        
        return updatedDetails;
      } else {
        itemDetails = details;
        // Update column list when loading table details
      if (details.columns) {
        const columnsWithMetadata = details.columns.filter((col: any) => 
          col.draftDescription || col.currentDescription || 
          (col.metadata && Object.keys(col.metadata).length > 0)
        );
          console.log('Found columns with metadata:', columnsWithMetadata.length);
        setTaggedColumns(columnsWithMetadata);
          
          // Only reset column index if we're not in column view or if this is a different table
          if (!wasInColumnView || (previousItemId && !previousItemId.startsWith(itemId.split('#')[0]))) {
        setCurrentColumnIndex(-1);
          } else {
            // Preserve column index if we were in column view and refreshing the same table
            console.log('Preserving column index:', previousColumnIndex);
          }
          
        setCurrentItemId(itemId);
        }
      }

      const updatedDetails = {
        ...itemDetails,
        currentColumn: !isColumn ? null : itemDetails.currentColumn,
        markedForRegeneration: itemDetails.markedForRegeneration || false,
        isMarkingForRegeneration: itemDetails.isMarkingForRegeneration || false,
        lastModified: itemDetails.lastModified || new Date().toISOString()
      };

      // Update the item in state
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: itemId,
          updates: updatedDetails
        }
      });

      // Cache both table and column details
      const newCache = { ...detailsCache };
      if (!isColumn) {
        newCache[itemId] = updatedDetails;
        // Cache all columns from this table
        details.columns?.forEach((col: any) => {
          const columnId = `${itemId}#column.${col.name.split('.').pop()}`;
          newCache[columnId] = {
            ...col,
            tableMarkedForRegeneration: updatedDetails.markedForRegeneration || false
          };
        });
      } else {
        newCache[itemId] = updatedDetails;
      }
      setDetailsCache(newCache);

      return updatedDetails;

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to load item details';
      console.error('Error loading item details:', error);
      setError(errorMessage);
      return null;
    } finally {
        setIsLoadingDetails(false);
      
      // Restore column view state if needed
      if (isColumnView && currentColumnIndex >= 0 && itemId.includes('#column.')) {
        console.log('loadItemDetails - Ensuring column view is preserved after refresh');
        setIsColumnView(true);
      }
    }
  };

  const preloadNextItem = async (currentIndex: number) => {
    if (currentIndex < items.length - 1) {
      // Preload the next item
      const nextItemIndex = currentIndex + 1;
      const nextItem = items[nextItemIndex];
      console.log('Preloading next item:', nextItem.id, 'at index:', nextItemIndex);
      
      try {
        // Only preload if not already in cache
        if (!detailsCache[nextItem.id]) {
          await loadItemDetails(nextItem.id, false);
          console.log('Successfully preloaded next item:', nextItem.id);
        } else {
          console.log('Next item already in cache:', nextItem.id);
        }
        
        // Also preload the item after that (look ahead by 2)
        if (nextItemIndex < items.length - 1) {
          const nextNextItemIndex = nextItemIndex + 1;
          const nextNextItem = items[nextNextItemIndex];
          console.log('Preloading next+1 item:', nextNextItem.id, 'at index:', nextNextItemIndex);
          
          // Only preload if not already in cache
          if (!detailsCache[nextNextItem.id]) {
            await loadItemDetails(nextNextItem.id, false);
            console.log('Successfully preloaded next+1 item:', nextNextItem.id);
          } else {
            console.log('Next+1 item already in cache:', nextNextItem.id);
          }
        }
      } catch (error) {
        console.error('Error preloading next item(s):', error);
      }
    }
  };

  const renderReviewMode = () => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) return null;

    // Get the correct item to display - either the column or the table
    // We need to ensure we're using the most up-to-date data from the state
    let displayItem: MetadataItem;
    const isColumnView = Boolean(currentItem.currentColumn);
    
    // Update isColumnView state to match what we're actually displaying
    if (isColumnView !== isColumnView) {
      console.log('Updating isColumnView state to match current view:', isColumnView);
      setIsColumnView(isColumnView);
    }
    
    console.log('renderReviewMode called with:', {
      currentItemId: currentItem.id,
      hasCurrentColumn: Boolean(currentItem.currentColumn),
      currentColumnIndex,
      isColumnView
    });
    
    if (isColumnView && currentItem.currentColumn) {
      // We're viewing a column
              displayItem = {
        ...currentItem.currentColumn,
        // Ensure we have all required properties
        id: currentItem.currentColumn.id || `${currentItem.id}#column.${currentItem.currentColumn.name.split('.').pop()}`,
        type: 'column', // Always set type to column when viewing a column
        parentTableId: currentItem.id
      };
      console.log('Rendering column view:', displayItem.id);
            } else {
      // We're viewing a table
              displayItem = {
                    ...currentItem,
        // Ensure currentColumn is null
        currentColumn: null,
        type: 'table' // Always set type to table when viewing a table
      };
      console.log('Rendering table view:', displayItem.id);
    }

    // Add more detailed logging to help with debugging
    console.log('Display item details:', {
      id: displayItem.id,
      type: displayItem.type,
      isColumnView,
      hasCurrentColumn: Boolean(currentItem.currentColumn),
      name: displayItem.name,
      status: displayItem.status,
      hasDraftDescription: Boolean(displayItem.draftDescription),
      hasCurrentDescription: Boolean(displayItem.currentDescription)
    });

    // Verify that displayItem has the necessary data
    if (!displayItem.id) {
      console.error('Invalid displayItem:', displayItem);
      setError('Display item is missing required data. Please refresh the page.');
      return null;
    }

    if (isLoadingDetails) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      );
    }

    // Debug information
    console.log('Review Mode State:', {
      currentItemId,
      displayItemId: displayItem.id,
      isColumnView,
      currentColumnIndex,
      taggedColumnsCount: taggedColumns.length
    });

    return (
      <Box>
        {/* Top Sticky Action Bar */}
        <Box sx={{ 
          p: 2, 
          mb: 2,
          position: 'sticky',
          top: 64,
          zIndex: 1,
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          {renderActionBar(currentItem)}
        </Box>

        {/* Main Content */}
        <Box sx={{ pb: 8 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  {isColumnView ? (
                    <>
                      Column: {displayItem.name.split('.').pop()}
                      <Typography component="span" variant="h5" color="text.secondary" sx={{ ml: 2 }}>
                        • Table: {displayItem.name.split('#')[0]}
                      </Typography>
                    </>
                  ) : (
                    displayItem.name
                  )}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={displayItem.type.charAt(0).toUpperCase() + displayItem.type.slice(1)}
                    size="small"
                    color={displayItem.type === 'table' ? 'primary' : 'secondary'}
                  />
                  <Chip
                    label={displayItem.status.charAt(0).toUpperCase() + displayItem.status.slice(1)}
                    size="small"
                    color={getStatusColor(displayItem.status)}
                  />
                  {(displayItem.markedForRegeneration) && (
                    <Chip
                      label="Marked for Regeneration"
                      size="small"
                      sx={{
                        backgroundColor: 'warning.main',
                        color: 'warning.contrastText'
                      }}
                      icon={<AutorenewIcon />}
                    />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Last modified: {new Date(displayItem.lastModified).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Remove the column navigation bar and context bar since we're showing column info in the header */}
            {/* Tags Section */}
            {displayItem.tags && Object.keys(displayItem.tags).length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {Object.entries(displayItem.tags).map(([key, value]) => (
                    <Chip
                      key={key}
                      label={`${key}: ${value}`}
                      variant="outlined"
                      sx={{ maxWidth: 200 }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Description Changes</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showDiff}
                      onChange={(e) => setShowDiff(e.target.checked)}
                    />
                  }
                  label={showDiff ? "Showing Diff View" : "Showing Side by Side"}
                />
              </Box>
              {showDiff ? (
                <Box sx={{ 
                  minHeight: '400px',
                  '& .diff-viewer': {
                    width: '100%',
                    minHeight: '400px'
                  },
                  '& .diff-container': {
                    margin: 0,
                    padding: '16px'
                  },
                  '& .diff-title-header': {
                    padding: '8px 16px',
                    background: '#f5f5f5',
                  }
                }}>
                  <ReactDiffViewer
                    oldValue={displayItem.currentDescription || ''}
                    newValue={displayItem.draftDescription || ''}
                    splitView={true}
                    leftTitle="Current Version"
                    rightTitle="Draft Version"
                    compareMethod={DiffMethod.WORDS}
                    styles={{
                      variables: {
                        light: {
                          diffViewerBackground: '#f8f9fa',
                          diffViewerColor: '#212529',
                          addedBackground: '#e6ffec',
                          addedColor: '#24292f',
                          removedBackground: '#ffebe9',
                          removedColor: '#24292f',
                          wordAddedBackground: '#abf2bc',
                          wordRemovedBackground: '#fdb8c0',
                        }
                      }
                    }}
                  />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h6" gutterBottom>Current Version</Typography>
                    <Paper sx={{ p: 2, minHeight: '200px' }}>
                      {displayItem.isHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: displayItem.currentDescription || 'No description available' }} />
                      ) : (
                        <Typography>{displayItem.currentDescription || 'No description available'}</Typography>
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" gutterBottom>Draft Version</Typography>
                    <Paper sx={{ p: 2, minHeight: '200px', bgcolor: displayItem.currentDescription !== displayItem.draftDescription ? 'rgba(200, 250, 205, 0.15)' : undefined }}>
                      {displayItem.isHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: displayItem.draftDescription || 'No draft description available' }} />
                      ) : (
                        <Typography>{displayItem.draftDescription || 'No draft description available'}</Typography>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              )}
            </Grid>
          </Grid>

          {/* Comments Section */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Comments
              </Typography>
              {renderComments(displayItem.comments)}
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment(displayItem.id);
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => handleAddComment(displayItem.id)}
                  disabled={!newComment.trim()}
                  sx={{ mt: 1 }}
                >
                  Add Comment
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* DEBUG Section - Remove before production */}
          <Card sx={{ mt: 2, bgcolor: 'grey.100' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" color="error">
                  DEBUG INFO - Remove before production
                </Typography>
                <Chip label="DEBUG" color="error" />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>Raw Item Data:</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify({
                        id: displayItem.id,
                        type: displayItem.type,
                        metadata: displayItem.metadata,
                        tags: displayItem.tags,
                        markedForRegeneration: displayItem.markedForRegeneration,
                        isMarkingForRegeneration: displayItem.isMarkingForRegeneration,
                        status: displayItem.status,
                        draftDescription: Boolean(displayItem.draftDescription),
                        currentDescription: Boolean(displayItem.currentDescription),
                      }, null, 2)}
                    </pre>
                  </Paper>
                </Grid>
                {displayItem.type === 'column' && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>Column-specific Debug Info:</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify({
                          profile: displayItem.profile,
                          metadata: {
                            certified: displayItem.metadata?.certified,
                            user_who_certified: displayItem.metadata?.user_who_certified,
                            generation_date: displayItem.metadata?.generation_date,
                            external_document_uri: displayItem.metadata?.external_document_uri
                          }
                        }, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const handleEditorChange = (content: string) => {
    if (editItem) {
      setEditItem((prev) =>
        prev ? { 
          ...prev, 
          draftDescription: content, 
          isHtml: isRichText 
        } : null
      );
    }
  };

  const handleRichTextToggle = (toRichText: boolean) => {
    const description = editItem?.draftDescription;
    if (!description) {
      setIsRichText(toRichText);
      return;
    }
    
    const content = toRichText
      ? description
          .split('\n')
          .map(line => `<p>${line}</p>`)
          .join('')
      : description.replace(/<[^>]*>/g, '');
    
    handleEditorChange(content);
    setIsRichText(toRichText);
  };

  const fetchReviewItems = async (nextPageToken?: string) => {
    try {
      setError(null);
      setIsLoading(true);
      console.log('Fetching review items...');
      
      const response = await axios.post(`${apiUrlBase}/metadata/review`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        dataset_settings: {
          project_id: config.project_id,
          dataset_id: config.dataset_id || "",
          documentation_csv_uri: "",
          strategy: "NAIVE"
        }
      });

      console.log('Received response:', response.data);

      // Ensure we have a properly structured response
      const { items: newItems = [], nextPageToken: newPageToken = null, totalCount: newTotalCount = 0 } = response.data;
      
      console.log(`Processing ${newItems.length} items with totalCount: ${newTotalCount}`);

      dispatch({
        type: 'SET_ITEMS',
        payload: {
          items: newItems,
          pageToken: newPageToken,
          totalCount: newTotalCount
        }
      });

      // If in review mode and we have items, load the first item's details
      if (viewMode === 'review' && newItems.length > 0) {
        await loadItemDetails(newItems[0].id);
        if (newItems.length > 1) {
          preloadNextItem(0);
        }
      }

    } catch (error: any) {
      console.error('Error fetching review items:', error);
      setError(error.response?.data?.detail || 'Failed to fetch review items');
      // Set empty items on error to prevent undefined errors
      dispatch({
        type: 'SET_ITEMS',
        payload: {
          items: [],
          pageToken: null,
          totalCount: 0
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add a debugging function
  const logDebugInfo = () => {
    const currentItem = items[currentItemIndex];
    console.group('ReviewPage Debug Information');
    console.log('Current State:', {
      viewMode,
      currentItemIndex,
      currentItemId,
      isColumnView: Boolean(currentItem?.currentColumn),
      taggedColumnsCount: taggedColumns.length,
      currentColumnIndex
    });
    
    if (currentItem) {
      console.log('Current Item:', {
        id: currentItem.id,
        type: currentItem.type,
        name: currentItem.name,
        hasCurrentColumn: Boolean(currentItem.currentColumn),
        currentColumnId: currentItem.currentColumn?.id
      });
    }
    
    console.log('Redux State:', state);
    console.log('Cache State:', {
      cacheKeys: Object.keys(detailsCache),
      currentItemInCache: currentItem ? Boolean(detailsCache[currentItem.id]) : false
    });
    console.groupEnd();
  };

  // Add this useEffect before the return statement
  useEffect(() => {
    // Clear accepting state whenever navigation changes
    // This ensures Accept buttons aren't greyed out after navigating
    setIsAccepting({});
    console.log('Navigation changed - clearing accepting state');
  }, [currentItemId, currentColumnIndex, isColumnView]);

  // Add a useEffect to monitor isRefreshing state changes
  useEffect(() => {
    console.log(`🔍 isRefreshing CHANGED to: ${isRefreshing}`, {
      stack: new Error().stack
    });
  }, [isRefreshing]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">
          Metadata Review
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            sx={{ 
              mr: 2,
              height: 36.5,
              '& .MuiToggleButton-root': {
                padding: '6px 16px',
                textTransform: 'none',
              }
            }}
          >
            <ToggleButton value="list">
              <ViewListIcon sx={{ mr: 1 }} />
              List
            </ToggleButton>
            <ToggleButton value="review">
              <RateReviewIcon sx={{ mr: 1 }} />
              Review
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<RefreshIcon sx={{ 
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </Alert>
      )}

      {isRefreshing && viewMode === 'list' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Fetching review items from Dataplex catalog...
        </Alert>
      )}

      {!isRefreshing && items.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No items found for review.
        </Alert>
      )}

      {viewMode === 'list' ? renderListMode() : renderReviewMode()}

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Edit Metadata
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5
            }}>
              <Button
                size="small"
                variant={isRichText ? "text" : "contained"}
                onClick={() => {
                  const description = editItem?.draftDescription;
                  if (isRichText && description) {
                    // Convert HTML to plain text
                    const plainText = description.replace(/<[^>]*>/g, '');
                    handleEditorChange(plainText);
                  }
                  setIsRichText(false);
                }}
                sx={{ minWidth: '90px' }}
              >
                Plain Text
              </Button>
              <Button
                size="small"
                variant={isRichText ? "contained" : "text"}
                onClick={() => {
                  const description = editItem?.draftDescription;
                  if (!isRichText && description) {
                    // Convert plain text to basic HTML
                    const htmlContent = description
                      .split('\n')
                      .map(line => `<p>${line}</p>`)
                      .join('');
                    handleEditorChange(htmlContent);
                  }
                  setIsRichText(true);
                }}
                sx={{ minWidth: '90px' }}
              >
                Rich Text
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {editItem && (
            <Box sx={{ pt: 2 }}>
          {isRichText ? (
            <ReactQuill
                  theme="snow"
                  value={editItem.draftDescription}
              onChange={handleEditorChange}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, false] }],
                      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                      [{'list': 'ordered'}, {'list': 'bullet'}],
                      ['link', 'clean']
                    ],
                  }}
                  formats={[
                    'header',
                    'bold', 'italic', 'underline', 'strike', 'blockquote',
                    'list', 'bullet',
                    'link'
                  ]}
                  style={{
                    height: '300px',
                    marginBottom: '50px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
            />
          ) : (
            <TextField
                  label="Draft Description"
                  value={editItem.draftDescription}
                  onChange={(e) => handleEditorChange(e.target.value)}
              multiline
                  rows={15}
              fullWidth
                  sx={{ mb: 2 }}
            />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReviewPage; 