import React, { useState, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Divider,
  Alert,
  SelectChangeEvent,
  RadioGroup,
  Radio,
  Card,
  CardContent,
} from '@mui/material';
import axios from 'axios';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

interface ClientOptionsSettings {
  use_lineage_tables: boolean;
  use_lineage_processes: boolean;
  use_profile: boolean;
  use_data_quality: boolean;
  use_ext_documents: boolean;
  persist_to_dataplex_catalog: boolean;
  stage_for_review: boolean;
  top_values_in_description: boolean;
  description_handling: 'append' | 'replace' | 'prepend';
  description_prefix: string;
}

interface ClientSettings {
  project_id: string;
  llm_location: string;
  dataplex_location: string;
}

interface TableSettings {
  project_id: string;
  dataset_id: string;
  table_id: string;
  documentation_uri: string;
}

interface DatasetSettings {
  project_id: string;
  dataset_id: string;
  documentation_csv_uri: string;
  strategy: string;
}

interface RegenerationCounts {
  tables: number;
  columns: number;
}

const GenerationPage = () => {
  const [params, setParams] = useState<{
    client_options_settings: ClientOptionsSettings;
    client_settings: ClientSettings;
    table_settings: TableSettings;
    dataset_settings: DatasetSettings;
  }>({
    client_options_settings: {
      use_lineage_tables: false,
      use_lineage_processes: false,
      use_profile: false,
      use_data_quality: false,
      use_ext_documents: false,
      persist_to_dataplex_catalog: true,
      stage_for_review: false,
      top_values_in_description: true,
      description_handling: 'append',
      description_prefix: '---AI Generated description---',
    },
    client_settings: {
      project_id: '',
      llm_location: '',
      dataplex_location: '',
    },
    table_settings: {
      project_id: '',
      dataset_id: '',
      table_id: '',
      documentation_uri: '',
    },
    dataset_settings: {
      project_id: '',
      dataset_id: '',
      documentation_csv_uri: '',
      strategy: 'NAIVE',
    },
  });

  const [apiUrlBase, setApiUrlBase] = useState<string>('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerationCounts, setRegenerationCounts] = useState<RegenerationCounts>({ tables: 0, columns: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [selectedForRegeneration, setSelectedForRegeneration] = useState<string[]>([]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    const [parent, child] = name.split('.');

    setParams((prevParams) => ({
      ...prevParams,
      [parent]: {
        ...prevParams[parent as keyof typeof prevParams],
        [child]: type === 'checkbox' ? checked : value,
      },
    }));

    // Sync project_id and dataset_id between table and dataset settings
    if (parent === 'table_settings' && (child === 'project_id' || child === 'dataset_id')) {
      setParams((prevParams) => ({
        ...prevParams,
        dataset_settings: {
          ...prevParams.dataset_settings,
          [child]: value,
        },
      }));
    }
  };

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    const [parent, child] = name.split('.');

    setParams((prevParams) => ({
      ...prevParams,
      [parent]: {
        ...prevParams[parent as keyof typeof prevParams],
        [child]: value,
      },
    }));
  };

  const callApi = async (endpoint: string) => {
    try {
      setError(null);
      setIsGenerating(true);

      const response = await axios.post(
        `${apiUrlBase}/${endpoint}`,
        params
      );

      setApiResponse(response.data);
      setIsGenerating(false);
    } catch (error) {
      console.error('API Error:', error);
      setError('An error occurred while calling the API. Please check the console for details.');
      setIsGenerating(false);
    }
  };

  const handleGetRegenerationCounts = async () => {
    try {
      setIsLoadingCounts(true);
      setError(null);
      const response = await axios.get(`${apiUrlBase}/get_regeneration_counts`);
      setRegenerationCounts(response.data);
    } catch (error) {
      console.error('API Error:', error);
      setError('Failed to fetch regeneration counts.');
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleRegenerateAll = async () => {
    try {
      setError(null);
      await axios.post(`${apiUrlBase}/regenerate_all`);
      // Refresh counts after regeneration
      handleGetRegenerationCounts();
    } catch (error) {
      console.error('API Error:', error);
      setError('Failed to trigger regeneration.');
    }
  };

  const handleRegenerateSelected = async () => {
    try {
      setError(null);
      await axios.post(`${apiUrlBase}/regenerate_selected`, {
        objects: selectedForRegeneration
      });
      // Refresh counts after regeneration
      handleGetRegenerationCounts();
    } catch (error) {
      console.error('API Error:', error);
      setError('Failed to trigger selective regeneration.');
    }
  };

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Metadata Generation
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Metadata Sources
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.use_lineage_tables"
                    checked={params.client_options_settings.use_lineage_tables}
                    onChange={handleInputChange}
                  />
                }
                label="Use Lineage Tables"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.use_lineage_processes"
                    checked={params.client_options_settings.use_lineage_processes}
                    onChange={handleInputChange}
                  />
                }
                label="Use Lineage Processes"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.use_profile"
                    checked={params.client_options_settings.use_profile}
                    onChange={handleInputChange}
                  />
                }
                label="Use Profile"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.use_data_quality"
                    checked={params.client_options_settings.use_data_quality}
                    onChange={handleInputChange}
                  />
                }
                label="Use Data Quality"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.use_ext_documents"
                    checked={params.client_options_settings.use_ext_documents}
                    onChange={handleInputChange}
                  />
                }
                label="Use External Documents"
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Description Handling
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl>
                <Typography variant="subtitle2" gutterBottom>
                  Description Placement
                </Typography>
                <RadioGroup
                  name="client_options_settings.description_handling"
                  value={params.client_options_settings.description_handling}
                  onChange={handleInputChange}
                >
                  <FormControlLabel
                    value="append"
                    control={<Radio />}
                    label="Append to existing description"
                  />
                  <FormControlLabel
                    value="prepend"
                    control={<Radio />}
                    label="Write at the beginning"
                  />
                  <FormControlLabel
                    value="replace"
                    control={<Radio />}
                    label="Replace existing description"
                  />
                </RadioGroup>
              </FormControl>

              <FormControl>
                <Typography variant="subtitle2" gutterBottom>
                  Description Prefix
                </Typography>
                <TextField
                  name="client_options_settings.description_prefix"
                  value={params.client_options_settings.description_prefix}
                  onChange={handleInputChange}
                  placeholder="Enter description prefix"
                  size="small"
                  fullWidth
                  helperText="This text will be added before the generated description"
                />
              </FormControl>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>
              Additional Options
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.persist_to_dataplex_catalog"
                    checked={params.client_options_settings.persist_to_dataplex_catalog}
                    onChange={handleInputChange}
                  />
                }
                label="Persist to Dataplex Catalog"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.stage_for_review"
                    checked={params.client_options_settings.stage_for_review}
                    onChange={handleInputChange}
                  />
                }
                label="Stage for Review"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="client_options_settings.top_values_in_description"
                    checked={params.client_options_settings.top_values_in_description}
                    onChange={handleInputChange}
                  />
                }
                label="Include Top Values in Description"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Project Configuration
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Project ID"
                name="client_settings.project_id"
                value={params.client_settings.project_id}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="LLM Location"
                name="client_settings.llm_location"
                value={params.client_settings.llm_location}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Dataplex Location"
                name="client_settings.dataplex_location"
                value={params.client_settings.dataplex_location}
                onChange={handleInputChange}
                fullWidth
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Table Configuration
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Project ID"
                name="table_settings.project_id"
                value={params.table_settings.project_id}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Dataset ID"
                name="table_settings.dataset_id"
                value={params.table_settings.dataset_id}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Table ID"
                name="table_settings.table_id"
                value={params.table_settings.table_id}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Documentation URI"
                name="table_settings.documentation_uri"
                value={params.table_settings.documentation_uri}
                onChange={handleInputChange}
                fullWidth
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Dataset Configuration
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Documentation CSV URI"
                name="dataset_settings.documentation_csv_uri"
                value={params.dataset_settings.documentation_csv_uri}
                onChange={handleInputChange}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="strategy-label">Strategy</InputLabel>
                <Select
                  labelId="strategy-label"
                  name="dataset_settings.strategy"
                  value={params.dataset_settings.strategy}
                  onChange={handleSelectChange}
                  label="Strategy"
                >
                  <MenuItem value="NAIVE">Naive</MenuItem>
                  <MenuItem value="DOCUMENTED">Documented</MenuItem>
                  <MenuItem value="DOCUMENTED_AND_REST">Documented and Rest</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>
              API Configuration
            </Typography>
            <TextField
              label="API Base URL"
              value={apiUrlBase}
              onChange={(e) => setApiUrlBase(e.target.value)}
              fullWidth
            />
          </Paper>
        </Grid>

        {/* Generation Actions Panel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>
              Generation Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                onClick={() => callApi('generate_table_description')}
                disabled={isGenerating}
                sx={{ flex: 1 }}
              >
                Generate Table Description
              </Button>
              <Button
                variant="contained"
                onClick={() => callApi('generate_columns_descriptions')}
                disabled={isGenerating}
                sx={{ flex: 1 }}
              >
                Generate Column Descriptions
              </Button>
              <Button
                variant="contained"
                onClick={() => callApi('generate_dataset_tables_descriptions')}
                disabled={isGenerating}
                sx={{ flex: 1 }}
              >
                Generate Dataset Tables
              </Button>
              <Button
                variant="contained"
                onClick={() => callApi('generate_dataset_tables_columns_descriptions')}
                disabled={isGenerating}
                sx={{ flex: 1 }}
              >
                Generate Dataset Tables and Columns
              </Button>
            </Box>

            {error && !error.includes('regeneration') && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {isGenerating && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Generating metadata...
              </Alert>
            )}

            {apiResponse && !('regeneration_counts' in apiResponse) && (
              <Box>
                <Typography variant="h2" gutterBottom>
                  Generation Result
                </Typography>
                <Paper sx={{ p: 2, backgroundColor: 'grey.100' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </Paper>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Regeneration Panel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f8f9fa' }}>
            <Typography variant="h2" gutterBottom sx={{ color: 'primary.main' }}>
              Regeneration
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleGetRegenerationCounts}
                    disabled={isLoadingCounts}
                    startIcon={<AutorenewIcon />}
                    fullWidth
                  >
                    Get Objects for Regeneration Count
                  </Button>
                  
                  {regenerationCounts.tables > 0 || regenerationCounts.columns > 0 ? (
                    <Card sx={{ mt: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Objects marked for regeneration:
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {regenerationCounts.tables}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Tables
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {regenerationCounts.columns}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Columns
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ) : null}
                </Box>

                {error && error.includes('regeneration') && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}

                {isLoadingCounts && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Fetching regeneration counts...
                  </Alert>
                )}
              </Grid>

              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleRegenerateAll}
                      disabled={regenerationCounts.tables === 0 && regenerationCounts.columns === 0}
                      startIcon={<AutorenewIcon />}
                      sx={{ flex: 1 }}
                    >
                      Regenerate All
                    </Button>
                    
                    <Button
                      variant="contained"
                      onClick={handleRegenerateSelected}
                      disabled={selectedForRegeneration.length === 0}
                      startIcon={<FilterAltIcon />}
                      sx={{ flex: 1 }}
                    >
                      Regenerate Selected
                    </Button>
                  </Box>

                  <TextField
                    label="Filter Pattern (e.g., project.dataset.table*)"
                    fullWidth
                    onChange={(e) => setSelectedForRegeneration([e.target.value])}
                    helperText="Use * as wildcard. Example: project.dataset.* for all tables in a dataset"
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GenerationPage; 