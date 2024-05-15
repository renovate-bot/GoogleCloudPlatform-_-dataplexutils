import React, { useState } from 'react';
import axios from 'axios';
import './styles.css';
import '@fontsource/roboto/400.css';
import {
  TextField, Button, FormControlLabel, Checkbox, Box
} from '@mui/material';

function App() {
  const [params, setParams] = useState({
    client_options_settings: {
      use_lineage_tables: false,
      use_lineage_processes: false,
      use_profile: false,
      use_data_quality: false,
      use_ext_documents: false,
    },
    client_settings: {
      project_id: '',
      llm_location: '',
      dataplex_location: '',
      documentation_uri: ''

    },
    table_settings: {
      project_id: '',
      dataset_id: '',
      table_id: '',
    },
  });

  const [apiResponse, setApiResponse] = useState(null);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const [parent, child] = name.split('.');

    setParams((prevParams) => ({
      ...prevParams,
      [parent]: {
        ...prevParams[parent],
        [child]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const callApi = async (endpoint) => {
    try {
      const response = await axios.post(
        `https://metadata-wizard-vc76aeajhq-uc.a.run.app/${endpoint}`,
        params
      );
      setApiResponse(response.data);
    } catch (error) {
      console.error("API Error:", error);
      console.error("Error Message:", error.message);
      setApiResponse({ error: "Network Error or API issue" });
    }
  };

  return (
    <div className="container">
      <h1 className="title">.::metadata wizard::.</h1>

      <Box className="settings-sections-container" >
        <Box className="settings-section">
          <h2>Select the additional metadata sources to use</h2>
          <div>
            <FormControlLabel
              control={<Checkbox
                name="client_options_settings.use_lineage_tables"
                checked={params.client_options_settings.use_lineage_tables}
                onChange={handleChange}
              />
              }
              label="Use Lineage Tables"
            />
          </div>
          <div>
            <FormControlLabel
              control={<Checkbox
                name="client_options_settings.use_lineage_processes"
                checked={params.client_options_settings.use_lineage_processes}
                onChange={handleChange}
              />
              }
              label="Use Lineage Processes"
            />
          </div>
          <div>
            <FormControlLabel
              control={<Checkbox
                name="client_options_settings.use_profile"
                checked={params.client_options_settings.use_profile}
                onChange={handleChange}
              />
              }
              label="Use Profile"
            />
          </div>
          <div>
            <FormControlLabel
              control={<Checkbox
                name="client_options_settings.use_data_quality"
                checked={params.client_options_settings.use_data_quality}
                onChange={handleChange}
              />
              }
              label="Use Data Quality"
            />
          </div>
          <div>
            <FormControlLabel
              control={<Checkbox
                name="client_options_settings.use_ext_documents"
                checked={params.client_options_settings.use_ext_documents}
                onChange={handleChange}
              />
              }
              label="Use External Documents"
            />
          </div>
        </Box>

        <Box className="settings-section">
          <h2>Enter LLM / Dataplex project details</h2>
          <div>
            <TextField
              label="Project ID"
              id="client_settings.project_id"
              name="client_settings.project_id"
              value={params.client_settings.project_id}
              onChange={handleChange}
              fullWidth
            />
          </div>
          <div>
            <TextField
              label="LLM Location"
              id="client_settings.llm_location"
              name="client_settings.llm_location"
              value={params.client_settings.llm_location}
              onChange={handleChange}
              fullWidth
            />
          </div>
          <div>
            <TextField
              label="Dataplex Location"
              id="client_settings.dataplex_location"
              name="client_settings.dataplex_location"
              value={params.client_settings.dataplex_location}
              onChange={handleChange}
              fullWidth
            />
          </div>
          <div>
            <TextField
              label="Documentation URI"
              id="client_settings.documentation_uri"
              name="client_settings.documentation_uri"
              value={params.client_settings.documentation_uri}
              onChange={handleChange}
              fullWidth
            />
          </div>
        </Box>

        <Box className="settings-section">
          <h2>Enter table to generate metadata</h2>
          <div>
            <TextField
              label="Project ID"
              id="table_settings.project_id"
              name="table_settings.project_id"
              value={params.table_settings.project_id}
              onChange={handleChange}
              fullWidth
            />
          </div>
          <div>
            <TextField
              label="Dataset ID"
              id="table_settings.dataset_id"
              name="table_settings.dataset_id"
              value={params.table_settings.dataset_id}
              onChange={handleChange}
              fullWidth
            />
          </div>
          <div>
            <TextField
              label="Table ID"
              id="table_settings.table_id"
              name="table_settings.table_id"
              value={params.table_settings.table_id}
              onChange={handleChange}
              fullWidth
            />
          </div>
        </Box>

      </Box>

      <Box >
        <Button variant="contained" onClick={() => callApi('generate_table_description')}>
          Generate Table Description
        </Button>
        <Button variant="contained" onClick={() => callApi('generate_columns_descriptions')}>
          Generate Column Descriptions
        </Button>
      </Box>

      {apiResponse && (
        <div className="response-section">
          <h2>API Response:</h2>
          <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
