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
import DeleteIcon from '@mui/icons-material/Delete';
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
import { useReview } from '../contexts/ReviewContext';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface Comment {
  id: string;
  text: string;
  type: 'human' | 'negative';
  timestamp: string;
}

interface MetadataItem {
  id: string;
  type: 'table' | 'column';
  name: string;
  currentDescription: string;
  draftDescription: string;
  isHtml: boolean;
  status: 'draft' | 'accepted' | 'rejected';
  lastModified: string;
  comments: Comment[];
  'to-be-regenerated'?: boolean;
  isMarkingForRegeneration?: boolean;
  generationDate?: string;
  whenAccepted?: string;
  externalDocumentUri?: string;
}

interface EditorChangeHandler {
  (content: string): void;
}

interface ReviewPageProps {
  config: DatplexConfig;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ config }) => {
  const { detailsCache, setDetailsCache, clearCache } = useCache();
  const { state, dispatch } = useReview();
  const { items, pageToken, totalCount, currentItemIndex, viewMode, hasLoadedItems } = state;

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
  const editorRef = useRef<any>(null);
  const [isAccepting, setIsAccepting] = useState<{ [key: string]: boolean }>({});
  const [showDiff, setShowDiff] = useState(true);

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
      fetchReviewItems();
      dispatch({ type: 'SET_HAS_LOADED', payload: true });
    }
  }, [apiUrlBase, config.project_id, hasLoadedItems]);

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newMode: 'list' | 'review' | null) => {
    if (newMode) {
      dispatch({ type: 'SET_VIEW_MODE', payload: newMode });
      if (newMode === 'review' && items.length > 0) {
        loadItemDetails(items[currentItemIndex].id);
        if (currentItemIndex < items.length - 1) {
          preloadNextItem(currentItemIndex);
        }
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (viewMode === 'list') {
      // For list view, refresh the entire list
      try {
        clearCache();
        dispatch({ type: 'SET_HAS_LOADED', payload: false });
        await fetchReviewItems();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // For review mode, only refresh the current item's details
      const currentItem = items[currentItemIndex];
      if (currentItem) {
        try {
          // Clear the cache for this item only
          setDetailsCache({
            ...detailsCache,
            [currentItem.id]: undefined
          });
          
          // Set loading state
          setIsLoadingDetails(true);
          
          // Reload just the item details
          await loadItemDetails(currentItem.id, true);
        } finally {
          setIsRefreshing(false);
          setIsLoadingDetails(false);
        }
      } else {
        setIsRefreshing(false);
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

  const handleSaveEdit = () => {
    if (editItem) {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { id: editItem.id, updates: editItem }
      });
      setEditDialogOpen(false);
      setEditItem(null);
    }
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_ITEM', payload: id });
  };

  const handleAddComment = (itemId: string) => {
    if (newComment.trim()) {
      const newCommentObj = {
        id: Date.now().toString(),
        text: newComment,
        type: commentType,
        timestamp: new Date().toISOString(),
      };
      
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: itemId,
          updates: {
            comments: [...(items.find(i => i.id === itemId)?.comments || []), newCommentObj]
          }
        }
      });
      
      setNewComment('');
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

    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
              />
            }
            label={showDiff ? "Showing Diff View" : "Showing Formatted View"}
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
              fontWeight: 'bold'
            }
          }}>
            <ReactDiffViewer
              oldValue={oldText}
              newValue={newText}
              splitView={true}
              useDarkTheme={false}
              leftTitle="Current Description"
              rightTitle="Draft Description"
              hideLineNumbers
              compareMethod={DiffMethod.WORDS}
              styles={{
                contentText: {
                  width: '100%',
                  fontSize: '14px',
                  lineHeight: '1.5'
                },
                line: {
                  wordBreak: 'break-word'
                }
              }}
            />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Current Description
              </Typography>
              {renderDescription(currentDescription, isHtml)}
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Draft Description
              </Typography>
              {renderDescription(draftDescription, isHtml)}
            </Grid>
          </Grid>
        )}
      </Box>
    );
  };

  const renderListMode = () => (
    <Box>
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="10%">Type</TableCell>
                <TableCell width="20%">Name</TableCell>
                <TableCell width="30%">Current Description</TableCell>
                <TableCell width="30%">Draft Description</TableCell>
                <TableCell width="10%">Status</TableCell>
                <TableCell width="15%">Last Modified</TableCell>
                <TableCell width="15%">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow 
                  key={item.id}
                  hover
                  onClick={() => handleEdit(item)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Chip
                      label={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      size="small"
                      color={item.type === 'table' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <Tooltip 
                      title={<Box dangerouslySetInnerHTML={{ __html: item.currentDescription }} />}
                      placement="bottom-start"
                    >
                      <Box>
                        {renderDescription(item.currentDescription, true, true)}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip 
                      title={<Box dangerouslySetInnerHTML={{ __html: item.draftDescription }} />}
                      placement="bottom-start"
                    >
                      <Box>
                        {renderDescription(item.draftDescription, true, true)}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      size="small"
                      color={getStatusColor(item.status)}
                    />
                  </TableCell>
                  <TableCell>{new Date(item.lastModified).toLocaleString()}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      color="primary"
                      onClick={() => handleAccept(item)}
                      disabled={item.status === 'accepted' || isAccepting[item.id]}
                      sx={{
                        '& .MuiSvgIcon-root': {
                          animation: isAccepting[item.id] ? 'spin 1s linear infinite' : 'none',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                          }
                        }
                      }}
                    >
                      <CheckCircleIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={() => handleEdit(item)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(item.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {pageToken && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => fetchReviewItems(pageToken)}
            disabled={isRefreshing}
          >
            Load More
          </Button>
        </Box>
      )}
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

    return (
      <Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderActionBar(currentItem)}
          </Grid>

          {isLoadingDetails ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>
                  Loading item details...
                </Typography>
              </Box>
            </Grid>
          ) : (
            <>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {currentItem.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
                          label="To be regenerated"
                          size="small"
                          color="warning"
                          icon={<AutorenewIcon />}
                        />
                      )}
                    </Box>
                    {currentItem.generationDate && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Generated: {new Date(currentItem.generationDate).toLocaleString()}
                      </Typography>
                    )}
                    {currentItem.whenAccepted && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Accepted: {new Date(currentItem.whenAccepted).toLocaleString()}
                      </Typography>
                    )}
                    {currentItem.externalDocumentUri && (
                      <Button
                        variant="outlined"
                        href={currentItem.externalDocumentUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<LaunchIcon />}
                        sx={{ mt: 1 }}
                      >
                        View External Document
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    {renderDescriptionWithDiff(
                      currentItem.currentDescription,
                      currentItem.draftDescription,
                      currentItem.isHtml
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Comments
                    </Typography>
                    <List>
                      {currentItem.comments.map((comment) => (
                        <React.Fragment key={comment.id}>
                          <ListItem>
                            <ListItemText
                              primary={<Box dangerouslySetInnerHTML={{ __html: comment.text }} />}
                              secondary={`${comment.type} - ${new Date(comment.timestamp).toLocaleString()}`}
                            />
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                    <Box sx={{ mt: 2 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        sx={{ mb: 1 }}
                      />
                      <ToggleButtonGroup
                        value={commentType}
                        exclusive
                        onChange={(e, value) => value && setCommentType(value)}
                        size="small"
                        sx={{ mb: 1 }}
                      >
                        <ToggleButton value="human">Human</ToggleButton>
                        <ToggleButton value="negative">Negative</ToggleButton>
                      </ToggleButtonGroup>
                      <Button
                        variant="contained"
                        onClick={() => handleAddComment(currentItem.id)}
                        disabled={!newComment.trim()}
                        fullWidth
                      >
                        Add Comment
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            {renderActionBar(currentItem)}
          </Grid>
        </Grid>
        {isLoadingNext && (
          <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 1, boxShadow: 1 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2">Loading next item...</Typography>
          </Box>
        )}
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
      setIsRefreshing(true);
      setError(null);

      if (!config.project_id) {
        setError('Project ID is not configured. Please set it in the Configuration page.');
        return;
      }

      // Clear cache when refreshing
      clearCache();

      const response = await axios.post(`${apiUrlBase}/metadata/review`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        dataset_settings: {
          project_id: config.project_id,
          dataset_id: config.dataset_id || "metadata_generation",
          documentation_csv_uri: config.documentation_csv_uri || "",
          strategy: config.strategy || "NAIVE"
        },
        page_token: nextPageToken
      });

      if (!response.data?.data) {
        dispatch({ type: 'SET_ITEMS', payload: [] });
        dispatch({ type: 'SET_TOTAL_COUNT', payload: 0 });
        dispatch({ type: 'SET_PAGE_TOKEN', payload: null });
        return;
      }

      const { items: responseItems, nextPageToken: newPageToken, totalCount: newTotalCount } = response.data.data;

      // Transform the API response into MetadataItem format
      const reviewItems: MetadataItem[] = (responseItems || []).map((item: any) => ({
        id: item.id || String(Math.random()),
        type: item.type || 'table',
        name: item.name || '',
        currentDescription: item.currentDescription || '',
        draftDescription: item.draftDescription || '',
        isHtml: true, // Always treat descriptions as HTML
        status: item.status || 'draft',
        lastModified: item.lastModified || new Date().toISOString(),
        comments: item.comments || [],
        'to-be-regenerated': item.markedForRegeneration || false
      }));

      if (nextPageToken) {
        dispatch({ type: 'APPEND_ITEMS', payload: reviewItems });
      } else {
        dispatch({ type: 'SET_ITEMS', payload: reviewItems });
      }
      
      dispatch({ type: 'SET_PAGE_TOKEN', payload: newPageToken });
      dispatch({ type: 'SET_TOTAL_COUNT', payload: newTotalCount });
    } catch (error: any) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch review items';
      setError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadItemDetails = async (itemId: string, setLoading = true) => {
    // If we're refreshing, don't use cache
    if (detailsCache[itemId] && !isRefreshing) {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { id: itemId, updates: detailsCache[itemId] }
      });
      return;
    }

    try {
      if (setLoading) {
        setIsLoadingDetails(true);
        setError(null);
      }
      
      console.log('=== START: loadItemDetails ===');
      console.log('ItemId:', itemId);

      const requestBody = {
        project_id: config.project_id,
        llm_location: config.llm_location || '',
        dataplex_location: config.dataplex_location || ''
      };
      
      const encodedId = encodeURIComponent(itemId);
      const url = `${apiUrlBase}/metadata/review/${encodedId}/details`;
      const response = await axios.post(url, requestBody);

      if (!response.data?.data) {
        throw new Error('No data returned from API');
      }

      // Update cache using the context's setDetailsCache
      setDetailsCache({
        ...detailsCache,
        [itemId]: response.data.data
      });

      dispatch({
        type: 'UPDATE_ITEM',
        payload: { id: itemId, updates: response.data.data }
      });

      return response.data.data;

    } catch (error: any) {
      console.error('=== ERROR in loadItemDetails ===');
      console.error('Error message:', error.message);
      let errorMessage = 'Failed to fetch item details';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'object' 
          ? JSON.stringify(error.response.data.detail)
          : error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      throw error;
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
      
      if (!detailsCache[nextItem.id]) {
        setIsLoadingNext(true);
        try {
          await loadItemDetails(nextItem.id, false);
        } finally {
          setIsLoadingNext(false);
        }
      } else {
        console.log('Next item already cached:', nextItem.id);
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
            <FormControlLabel
              control={
                <Switch
                  checked={isRichText}
                  onChange={(e) => {
                    const newIsRichText = e.target.checked;
                    setIsRichText(newIsRichText);
                    if (editItem) {
                      // Convert content when switching modes
                      if (newIsRichText) {
                        // Convert plain text to basic HTML
                        const htmlContent = editItem.draftDescription
                          .split('\n')
                          .map(line => `<p>${line}</p>`)
                          .join('');
                        handleEditorChange(htmlContent);
                      } else {
                        // Strip HTML tags for plain text
                        const plainText = editItem.draftDescription.replace(/<[^>]*>/g, '');
                        handleEditorChange(plainText);
                      }
                    }
                  }}
                />
              }
              label={isRichText ? "Rich Text" : "Plain Text"}
            />
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