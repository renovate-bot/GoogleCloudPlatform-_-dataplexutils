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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (viewMode === 'list') {
        // In list mode, refresh the entire list
        await fetchReviewItems();
      } else if (viewMode === 'review' && items[currentItemIndex]) {
        // In review mode, only refresh the current item's details
        await loadItemDetails(items[currentItemIndex].id, true);
        // Clear the cache for this item to ensure we get fresh data
        setDetailsCache({
          ...detailsCache,
          [items[currentItemIndex].id]: undefined
        });
      }
    } finally {
      setIsRefreshing(false);
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
      setError(null);
      setIsAccepting(prev => ({ ...prev, [item.id]: true }));
      
      const tableFqn = item.id.split('#')[0];
      const [projectId, datasetId, tableId] = tableFqn.split('.');
      const isColumn = item.type === 'column';
      const columnName = isColumn ? item.id.split('#column.')[1] : undefined;
      
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
        column_name: columnName
      });

      // Update both state and cache with the accepted status
      const updatedItem: Partial<MetadataItem> = {
        status: 'accepted' as const,
        currentDescription: item.draftDescription,
        whenAccepted: new Date().toISOString()
      };

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

      // If in review mode, refresh the item details to get the updated state
      if (viewMode === 'review') {
        await loadItemDetails(item.id, true);
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
    } finally {
      setIsAccepting(prev => ({ ...prev, [item.id]: false }));
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
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');

      dispatch({
        type: 'UPDATE_ITEM',
        payload: { id: itemId, updates: { isMarkingForRegeneration: true } }
      });

      const nameParts = item.name.split('.');
      let table_fqn: string;
      let column_name: string | undefined;

      if (item.type === 'table') {
        table_fqn = nameParts.slice(0, 3).join('.');
      } else {
        table_fqn = nameParts.slice(0, 3).join('.');
        column_name = nameParts[3];
      }

      const response = await axios.post(`${apiUrlBase}/mark_for_regeneration`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        request: {
          table_fqn,
          column_name
        }
      });

      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: itemId,
          updates: {
            toBeRegenerated: true,
            isMarkingForRegeneration: false
          }
        }
      });

      setError(null);
    } catch (error: any) {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { id: itemId, updates: { isMarkingForRegeneration: false } }
      });
      console.error('API Error:', error);
      let errorMessage: string;
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'object'
          ? JSON.stringify(error.response.data.detail)
          : error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Failed to mark item for regeneration';
      }
      setError(errorMessage);
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
      loadItemDetails(prevItem.id);
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
    <Box>
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
                        disabled={item.toBeRegenerated || item['to-be-regenerated'] || item.metadata?.to_be_regenerated || item.isMarkingForRegeneration}
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
    const isViewingColumn = currentItem.type === 'column' || Boolean(currentItem.currentColumn);
    const isViewingTable = !isViewingColumn;
    
    // Check if the current table has tagged columns
    const hasTaggedColumns = taggedColumns.length > 0;
    
    // Debug information
    console.log('Action Bar State:', {
      isViewingColumn,
      isViewingTable,
      hasTaggedColumns,
      currentColumnIndex,
      taggedColumnsCount: taggedColumns.length,
      currentItemId,
      currentItemType: currentItem.type,
      hasCurrentColumn: Boolean(currentItem.currentColumn)
    });
    
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
          {/* Debug button */}
          <Button
            variant="outlined"
            color="warning"
            onClick={logDebugInfo}
            size="small"
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
      isHtml: false
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
      isHtml: false
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

      // Use cache if available and not forcing refresh
      if (!forceRefresh && detailsCache[itemId]) {
        console.log('Using cached item details:', itemId);
        const cachedDetails = detailsCache[itemId];

        if (itemId.includes('#column.')) {
          const columnDetails = {
            ...cachedDetails,
            id: itemId,
            type: 'column',
            comments: cachedDetails.comments || [],
            currentDescription: cachedDetails.currentDescription || '',
            draftDescription: cachedDetails.draftDescription || '',
            status: cachedDetails.status || 'draft'
          };
          dispatch({
            type: 'UPDATE_ITEM',
            payload: {
              id: itemId,
              updates: columnDetails
            }
          });

          const tableId = itemId.split('#')[0];
          if (tableId !== currentItemId) {
            const tableDetails = detailsCache[tableId];
            if (tableDetails?.columns) {
              const columnsWithMetadata = tableDetails.columns.filter((col: any) => 
                col.draftDescription || col.currentDescription || 
                (col.metadata && Object.keys(col.metadata).length > 0)
              );
              setTaggedColumns(columnsWithMetadata);
              const columnName = itemId.split('#column.')[1];
              const columnIndex = columnsWithMetadata.findIndex(col => col.name.endsWith(columnName));
              if (columnIndex !== -1) {
                setCurrentColumnIndex(columnIndex);
              }
            }
          }
          return columnDetails;
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
        }
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
          setCurrentColumnIndex(-1);
          setCurrentItemId(itemId);
        }
      }

      const updatedDetails = {
        ...itemDetails,
        currentColumn: !isColumn ? null : itemDetails.currentColumn,
        'to-be-regenerated': itemDetails.markedForRegeneration,
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
          newCache[columnId] = col;
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
    }
  };

  const preloadNextItem = async (currentIndex: number) => {
    if (currentIndex < items.length - 1) {
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
      } catch (error) {
        console.error('Error preloading next item:', error);
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
    
    console.log('renderReviewMode called with:', {
      currentItemId: currentItem.id,
      hasCurrentColumn: Boolean(currentItem.currentColumn),
      currentColumnIndex
    });
    
    if (isColumnView && currentItem.currentColumn) {
      // We're viewing a column
      displayItem = {
        ...currentItem.currentColumn,
        // Ensure we have all required properties
        id: currentItem.currentColumn.id || `${currentItem.id}#column.${currentItem.currentColumn.name.split('.').pop()}`,
        type: 'column',
        parentTableId: currentItem.id
      };
      console.log('Rendering column view:', displayItem.id);
    } else {
      // We're viewing a table
      displayItem = {
        ...currentItem,
        // Ensure currentColumn is null
        currentColumn: null
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
                  {(displayItem.toBeRegenerated || displayItem['to-be-regenerated'] || displayItem.metadata?.to_be_regenerated) && (
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
                        toBeRegenerated: displayItem.toBeRegenerated,
                        'to-be-regenerated': displayItem['to-be-regenerated'],
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
                            to_be_regenerated: displayItem.metadata?.to_be_regenerated,
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