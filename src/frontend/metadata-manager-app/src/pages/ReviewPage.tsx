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

  // Initialize API URL
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    setApiUrlBase(apiUrl);
  }, []);

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
        // Only load details if not in cache
        if (!detailsCache[itemId]) {
          await loadItemDetails(itemId);
          
          // Preload the next item if there is one and it's not cached
          if (itemIndex < items.length - 1) {
            const nextItem = items[itemIndex + 1];
            if (!detailsCache[nextItem.id]) {
              await preloadNextItem(itemIndex);
            }
          }
        }
      } catch (error) {
        console.error('Error loading item details:', error);
      }
    }
  };

  const handleAccept = async (item: MetadataItem) => {
    try {
      setError(null);
      setIsAccepting(prev => ({ ...prev, [item.id]: true }));
      
      // Extract table FQN from the item ID
      const tableFqn = item.id.split('#')[0];
      const [projectId, datasetId, tableId] = tableFqn.split('.');
      
      const response = await axios.post(`${apiUrlBase}/accept_table_draft_description`, {
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
          documentation_uri: item.externalDocumentUri || ""
        },
        dataset_settings: {
          project_id: projectId,
          dataset_id: datasetId,
          documentation_csv_uri: "",
          strategy: "NAIVE"
        }
      });

      // Update the item in the UI to reflect acceptance
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { 
          id: item.id, 
          updates: { 
            status: 'accepted',
            currentDescription: item.draftDescription, // Update the current description with the draft
            whenAccepted: new Date().toISOString()
          } 
        }
      });

      // Clear the cache for this item to ensure fresh data on next load
      setDetailsCache({
        ...detailsCache,
        [item.id]: undefined
      });

      // If in review mode, refresh the item details to get the updated state
      if (viewMode === 'review' && items[currentItemIndex].id === item.id) {
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
    setEditItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editItem) {
      try {
        setError(null);
        
        const tableFqn = editItem.id.split('#')[0];
        const [projectId, datasetId, tableId] = tableFqn.split('.');
        const isColumn = editItem.id.includes('#column.');
        const columnName = isColumn ? editItem.id.split('#column.')[1] : undefined;
        
        await axios.post(`${apiUrlBase}/update_table_draft_description`, {
          client_settings: {
            project_id: config.project_id,
            llm_location: config.llm_location,
            dataplex_location: config.dataplex_location,
          },
          table_settings: {
            project_id: projectId,
            dataset_id: datasetId,
            table_id: tableId,
            documentation_uri: editItem.externalDocumentUri || ""
          },
          description: editItem.draftDescription,
          is_html: isRichText
        });
        
        dispatch({
          type: 'UPDATE_ITEM',
          payload: { 
            id: editItem.id, 
            updates: {
              ...editItem,
              lastModified: new Date().toISOString()
            }
          }
        });
        
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
        column_name: columnName
      });

      const updatedComments = [...(item.comments || []), newComment];
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { 
          id: itemId, 
          updates: { comments: updatedComments } 
        }
      });

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
            'to-be-regenerated': true,
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

  const handleNext = async () => {
    if (currentItemIndex < items.length - 1) {
      const nextIndex = currentItemIndex + 1;
      dispatch({ type: 'SET_CURRENT_INDEX', payload: nextIndex });
      await loadItemDetails(items[nextIndex].id);
      if (nextIndex < items.length - 2) {
        preloadNextItem(nextIndex);
      }
    }
  };

  const handlePrevious = async () => {
    if (currentItemIndex > 0) {
      const prevIndex = currentItemIndex - 1;
      dispatch({ type: 'SET_CURRENT_INDEX', payload: prevIndex });
      await loadItemDetails(items[prevIndex].id);
      if (prevIndex < items.length - 1) {
        preloadNextItem(prevIndex);
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
              label={showDiff ? "Showing Diff View" : "Showing Both Versions"}
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

  const renderComments = (comments: string[]) => (
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
              <TableCell>Regeneration</TableCell>
              <TableCell>Last Modified</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
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
                  {item['to-be-regenerated'] && (
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
                </TableCell>
                <TableCell>
                  {new Date(item.lastModified).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  <Box onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      onClick={() => handleViewDetails(item.id)}
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleMarkForRegeneration(item.id)}
                      size="small"
                      disabled={item['to-be-regenerated'] || item.isMarkingForRegeneration}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderActionBar = (currentItem: MetadataItem) => (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      backgroundColor: 'background.paper',
      p: 2,
      borderRadius: 1,
      boxShadow: 1
    }}>
      <Box>
        <Button
          variant="contained"
          onClick={() => handleAccept(currentItem)}
          disabled={currentItem.status === 'accepted' || isAccepting[currentItem.id]}
          startIcon={<CheckCircleIcon sx={{ 
            animation: isAccepting[currentItem.id] ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }} />}
          sx={{ mr: 1 }}
        >
          {isAccepting[currentItem.id] ? 'Accepting...' : 'Accept'}
        </Button>
        <Button
          variant="contained"
          onClick={() => handleMarkForRegeneration(currentItem.id)}
          startIcon={<AutorenewIcon sx={{ 
            animation: currentItem.isMarkingForRegeneration ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }} />}
          disabled={currentItem['to-be-regenerated'] || currentItem.isMarkingForRegeneration}
          sx={{ mr: 1 }}
        >
          {currentItem.isMarkingForRegeneration 
            ? 'Marking...' 
            : currentItem['to-be-regenerated'] 
              ? 'Marked for Regeneration' 
              : 'Mark for Regeneration'}
        </Button>
        <Button
          variant="contained"
          onClick={() => handleEditInReview(currentItem)}
          startIcon={<EditIcon />}
        >
          Edit
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {currentItemIndex + 1} of {items.length}
        </Typography>
        <Button
          variant="outlined"
          onClick={handlePrevious}
          disabled={currentItemIndex === 0}
          startIcon={<NavigateBeforeIcon />}
        >
          Previous
        </Button>
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

  const renderReviewMode = () => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) return null;

    console.log('Rendering review mode for item:', currentItem);

    // Add loading indicator while details are being fetched
    if (isLoadingDetails) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box>
        {/* Top Sticky Action Bar */}
        <Box sx={{ 
          p: 2, 
          mb: 2,
          position: 'sticky',
          top: 64, // Height of the top navigation bar
          zIndex: 1,
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          {renderActionBar(currentItem)}
        </Box>

        {/* Main Content */}
        <Box sx={{ pb: 8 }}> {/* Add padding at bottom to prevent content from being hidden behind bottom bar */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box>
              <Typography variant="h5" gutterBottom>
                {currentItem.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={currentItem.type.charAt(0).toUpperCase() + currentItem.type.slice(1)}
                  size="small"
                  color={currentItem.type === 'table' ? 'primary' : 'secondary'}
                />
                <Chip
                  label={currentItem.status.charAt(0).toUpperCase() + currentItem.status.slice(1)}
                  size="small"
                  color={getStatusColor(currentItem.status)}
                />
                {currentItem['to-be-regenerated'] && (
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
                  Last modified: {new Date(currentItem.lastModified).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showDiff}
                        onChange={(e) => setShowDiff(e.target.checked)}
                      />
                    }
                    label={showDiff ? "Showing Diff View" : "Showing Both Versions"}
                  />
                </Box>
              </Box>
            </Grid>

            {showDiff ? (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
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
                        oldValue={currentItem.currentDescription}
                        newValue={currentItem.draftDescription}
                        splitView={true}
                        leftTitle="Current Version"
                        rightTitle="Draft Version"
                        compareMethod={DiffMethod.WORDS}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              <>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Current Description
                      </Typography>
                      {renderDescription(currentItem.currentDescription, currentItem.isHtml)}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Draft Description
                      </Typography>
                      {renderDescription(currentItem.draftDescription, currentItem.isHtml)}
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Comments
                  </Typography>
                  {renderComments(currentItem.comments)}
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                    />
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        onClick={() => handleAddComment(currentItem.id)}
                        disabled={!newComment.trim()}
                      >
                        Add Comment
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Bottom Sticky Action Bar */}
        <Box sx={{ 
          p: 2,
          position: 'fixed',
          bottom: 0,
          left: 240, // Width of the left menu
          right: 0,
          zIndex: 1,
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: '0px -2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          {renderActionBar(currentItem)}
        </Box>
      </Box>
    );
  };

  const handleEditorChange = (content: string) => {
    if (editItem) {
      setEditItem((prev) =>
        prev ? { ...prev, draftDescription: content, isHtml: isRichText } : null
      );
    }
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

  const loadItemDetails = async (itemId: string, setLoading = true) => {
    try {
      if (setLoading) {
        setIsLoadingDetails(true);
      }
      setError(null);

      // Use cache if available and not explicitly refreshing
      if (detailsCache[itemId] && !setLoading) {
        console.log('Using cached item details:', detailsCache[itemId]);
        // Update the item in the state with cached details to ensure consistency
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: itemId,
            updates: detailsCache[itemId]
          }
        });
        return detailsCache[itemId];
      }

      const [projectId, datasetId, tableId] = itemId.split('#')[0].split('.');
      const isColumn = itemId.includes('#column.');
      const columnName = isColumn ? itemId.split('#column.')[1] : undefined;

      console.log(`${setLoading ? 'Fetching' : 'Preloading'} details for item:`, itemId);
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
        column_name: columnName
      });

      // Response is no longer wrapped in a data field
      const details = response.data;
      console.log(`${setLoading ? 'Received' : 'Preloaded'} item details:`, details);

      // Use the regeneration status from the API response
      const updatedDetails = {
        ...details,
        'to-be-regenerated': details.markedForRegeneration,
        lastModified: details.lastModified || new Date().toISOString()
      };

      // Update the item in the state with the new details
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: itemId,
          updates: updatedDetails
        }
      });

      // Update cache
      setDetailsCache({
        ...detailsCache,
        [itemId]: updatedDetails
      });

      return updatedDetails;

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to load item details';
      if (setLoading) {
        // Only show errors to the user for active loading, not preloading
        console.error('Error loading item details:', error);
        setError(errorMessage);
      } else {
        console.warn('Error preloading item details:', errorMessage);
      }
      return null;
    } finally {
      if (setLoading) {
        setIsLoadingDetails(false);
      }
    }
  };

  // Function to preload next item
  const preloadNextItem = async (currentIndex: number) => {
    if (currentIndex < items.length - 1) {
      const nextItemIndex = currentIndex + 1;
      const nextItem = items[nextItemIndex];
      console.log('Preloading next item:', nextItem.id, 'at index:', nextItemIndex);
      
      try {
        // Always load the next item's details, don't rely on cache for preloading
        await loadItemDetails(nextItem.id, false);
        console.log('Successfully preloaded next item:', nextItem.id);
      } catch (error) {
        console.error('Error preloading next item:', error);
      }
    }
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
                  if (isRichText && editItem) {
                    // Convert HTML to plain text
                    const plainText = editItem.draftDescription.replace(/<[^>]*>/g, '');
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
                  if (!isRichText && editItem) {
                    // Convert plain text to basic HTML
                    const htmlContent = editItem.draftDescription
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