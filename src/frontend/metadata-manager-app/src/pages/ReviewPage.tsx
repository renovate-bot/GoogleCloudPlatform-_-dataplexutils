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
  markedForRegeneration?: boolean;
}

interface EditorChangeHandler {
  (content: string): void;
}

const ReviewPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'review'>('list');
  const [items, setItems] = useState<MetadataItem[]>([
    {
      id: '1',
      type: 'table',
      name: 'example_dataset.example_table',
      currentDescription: 'Original description of the table...',
      draftDescription: 'This table contains example data...',
      isHtml: false,
      status: 'draft',
      lastModified: '2024-02-03',
      comments: [
        {
          id: '1',
          text: 'Description needs more context',
          type: 'human',
          timestamp: '2024-02-03T10:00:00Z',
        },
        {
          id: '2',
          text: 'Missing data quality information',
          type: 'negative',
          timestamp: '2024-02-03T10:01:00Z',
        },
      ],
    },
    {
      id: '2',
      type: 'column',
      name: 'example_dataset.example_table.user_id',
      currentDescription: 'User identifier',
      draftDescription: 'Unique identifier for users...',
      isHtml: false,
      status: 'draft',
      lastModified: '2024-02-03',
      comments: [],
    },
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
          project_id: '',
          llm_location: '',
          dataplex_location: '',
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

  const handleMarkForRegeneration = (itemId: string) => {
    // TODO: Implement regeneration API call
    console.log('Marking for regeneration:', itemId);
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? { ...item, markedForRegeneration: true }
          : item
      )
    );
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
          startIcon={<AutorenewIcon />}
          disabled={currentItem.markedForRegeneration}
          sx={{ mr: 1 }}
        >
          {currentItem.markedForRegeneration ? 'Marked for Regeneration' : 'Mark for Regeneration'}
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
                  {currentItem.markedForRegeneration && (
                    <Chip
                      label="Marked for Regeneration"
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
              height: 36.5, // Match MUI button default height
              '& .MuiToggleButton-root': {
                padding: '6px 16px', // Match MUI button default padding
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
            startIcon={<RefreshIcon />}
            onClick={() => {/* Implement refresh logic */}}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
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