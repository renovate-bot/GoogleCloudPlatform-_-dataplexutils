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
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { DatplexConfig } from '../App';

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
}

interface EditorChangeHandler {
  (content: string): void;
}

interface ReviewPageProps {
  config: DatplexConfig;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ config }) => {
  const [viewMode, setViewMode] = useState<'list' | 'review'>('list');
  const [items, setItems] = useState<MetadataItem[]>([
    {
      id: '1',
      type: 'table',
      name: 'jsk-dataplex-demo-380508.metadata_generation.cc',
      currentDescription: 'Credit card transactions table',
      draftDescription: 'This table contains credit card transaction data including transaction details and customer information.',
      isHtml: false,
      status: 'draft',
      lastModified: new Date().toISOString(),
      comments: [],
      'to-be-regenerated': false
    },
    {
      id: '2',
      type: 'column',
      name: 'jsk-dataplex-demo-380508.metadata_generation.cc.transaction_id',
      currentDescription: 'Transaction identifier',
      draftDescription: 'Unique identifier for each credit card transaction',
      isHtml: false,
      status: 'draft',
      lastModified: new Date().toISOString(),
      comments: [],
      'to-be-regenerated': false
    }
  ]);

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [editItem, setEditItem] = useState<MetadataItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'human' | 'negative'>('human');
  const [apiUrlBase, setApiUrlBase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRichText, setIsRichText] = useState(false);
  const editorRef = useRef<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initialize API URL
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
  }, [viewMode]);

  const handleAccept = async (item: MetadataItem) => {
    try {
      setError(null);
      const endpoint = item.type === 'table' 
        ? 'accept_table_draft_description'
        : 'accept_column_draft_description';

      const [project, dataset, table, column] = item.name.split('.');
      
      const response = await axios.post(`${apiUrlBase}/${endpoint}`, {
        client_options_settings: {
          use_lineage_tables: false,
          use_lineage_processes: false,
          use_profile: false,
          use_data_quality: false,
          use_ext_documents: false,
          persist_to_dataplex_catalog: true,
          stage_for_review: false,
          top_values_in_description: true,
        },
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        table_settings: {
          project_id: project,
          dataset_id: dataset,
          table_id: table,
          documentation_uri: '',
        },
        ...(item.type === 'column' && {
          column_settings: {
            column_name: column,
          },
        }),
      });

      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === item.id ? { ...i, status: 'accepted' } : i
        )
      );
    } catch (error) {
      console.error('API Error:', error);
      setError('An error occurred while accepting the draft. Please check the console for details.');
    }
  };

  const handleEdit = (item: MetadataItem) => {
    // Find the index of the item to edit
    const itemIndex = items.findIndex((i) => i.id === item.id);
    if (itemIndex !== -1) {
      setCurrentItemIndex(itemIndex);
      setViewMode('review');
    }
  };

  // Separate handler for editing in review mode
  const handleEditInReview = (item: MetadataItem) => {
    setEditItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editItem) {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === editItem.id ? editItem : item
        )
      );
      setEditDialogOpen(false);
      setEditItem(null);
    }
  };

  const handleDelete = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const handleAddComment = (itemId: string) => {
    if (newComment.trim()) {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                comments: [
                  ...item.comments,
                  {
                    id: Date.now().toString(),
                    text: newComment,
                    type: commentType,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : item
        )
      );
      setNewComment('');
    }
  };

  const handleMarkForRegeneration = async (itemId: string) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Set loading state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? { ...item, isMarkingForRegeneration: true }
            : item
        )
      );

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

      // Update success state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? { ...item, 'to-be-regenerated': true, isMarkingForRegeneration: false }
            : item
        )
      );

      setError(null);
    } catch (error: any) {
      // Reset loading state on error
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? { ...item, isMarkingForRegeneration: false }
            : item
        )
      );
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to mark item for regeneration';
      setError(errorMessage);
    }
  };

  const handleNext = () => {
    setCurrentItemIndex((prev) => 
      prev < items.length - 1 ? prev + 1 : prev
    );
  };

  const handlePrevious = () => {
    setCurrentItemIndex((prev) => 
      prev > 0 ? prev - 1 : prev
    );
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

  const renderListMode = () => (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Draft Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Modified</TableCell>
              <TableCell>Actions</TableCell>
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
                <TableCell>{item.draftDescription}</TableCell>
                <TableCell>
                  <Chip
                    label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    size="small"
                    color={getStatusColor(item.status)}
                  />
                </TableCell>
                <TableCell>{item.lastModified}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    color="primary"
                    onClick={() => handleAccept(item)}
                    disabled={item.status === 'accepted'}
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
          disabled={currentItem.status === 'accepted'}
          startIcon={<CheckCircleIcon />}
          sx={{ mr: 1 }}
        >
          Accept
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

  const renderDescription = (description: string, isHtml: boolean) => {
    if (isHtml) {
      return (
        <Typography
          variant="body1"
          component="div"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      );
    }
    return <Typography variant="body1">{description}</Typography>;
  };

  const renderReviewMode = () => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) return null;

    return (
      <Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderActionBar(currentItem)}
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {currentItem.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
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
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Description
                </Typography>
                {renderDescription(currentItem.currentDescription, currentItem.isHtml)}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Draft Description
                </Typography>
                {renderDescription(currentItem.draftDescription, currentItem.isHtml)}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
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
                          primary={comment.text}
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

          <Grid item xs={12}>
            {renderActionBar(currentItem)}
          </Grid>
        </Grid>
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

  // Update fetchReviewItems to use config
  const fetchReviewItems = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Ensure we have required parameters
      if (!config.project_id) {
        setError('Project ID is not configured. Please set it in the Configuration page.');
        return;
      }

      const response = await axios.post(`${apiUrlBase}/metadata/review`, {
        client_settings: {
          project_id: config.project_id,
          llm_location: config.llm_location,
          dataplex_location: config.dataplex_location,
        },
        dataset_settings: {
          project_id: config.project_id,
          dataset_id: "metadata_generation",  // TODO: Make this configurable
          documentation_csv_uri: "",
          strategy: "NAIVE"
        }
      });

      if (!response.data || !response.data.items) {
        setItems([]);
        return;
      }

      // Transform the API response into MetadataItem format
      const reviewItems: MetadataItem[] = (response.data.items || []).map((item: any) => ({
        id: item.id || String(Math.random()),  // Fallback to random ID if none provided
        type: item.type || 'table',
        name: item.name || '',
        currentDescription: item.currentDescription || '',
        draftDescription: item.draftDescription || '',
        isHtml: item.isHtml || false,
        status: item.status || 'draft',
        lastModified: item.lastModified || new Date().toISOString(),
        comments: item.comments || [],
        'to-be-regenerated': item.markedForRegeneration || false
      }));

      setItems(reviewItems);
    } catch (error: any) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch review items';
      setError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update useEffect to use config
  useEffect(() => {
    if (apiUrlBase && config.project_id) {
      fetchReviewItems();
    }
  }, [apiUrlBase, config.project_id]);

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
            onChange={(e, value) => value && setViewMode(value)}
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
            onClick={fetchReviewItems}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isRefreshing && (
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