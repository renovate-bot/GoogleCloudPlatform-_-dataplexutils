import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import TopNavBar from './components/navigation/TopNavBar';
import LeftMenu from './components/navigation/LeftMenu';
import ReviewPage from './pages/ReviewPage';
import GenerationPage from './pages/GenerationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import SLADashboard from './pages/contracts/SLADashboard';
import ContractTemplates from './pages/contracts/ContractTemplates';
import ContractCompliance from './pages/contracts/ContractCompliance';
import SLAGenerator from './pages/contracts/SLAGenerator';
import ContractTerms from './pages/contracts/ContractTerms';
import DataProductEvaluation from './pages/contracts/DataProductEvaluation';
import DataProductDiagnostics from './pages/contracts/DataProductDiagnostics';
import DiagnosticsOverview from './pages/contracts/DiagnosticsOverview';
import { Task } from './components/TaskTracker';
import ComplianceOverview from './pages/compliance/ComplianceOverview';
import DataSensitivity from './pages/compliance/DataSensitivity';
import AccessPolicies from './pages/compliance/AccessPolicies';
import RetentionPolicies from './pages/compliance/RetentionPolicies';
import GovernancePolicies from './pages/compliance/GovernancePolicies';
import PublishingOverview from './pages/publishing/PublishingOverview';
import Marketplaces from './pages/publishing/Marketplaces';
import PublishingHistory from './pages/publishing/PublishingHistory';
import PublishingDestinations from './pages/publishing/PublishingDestinations';
import PublishingSettings from './pages/publishing/PublishingSettings';

export interface DatplexConfig {
  // Client Settings
  project_id: string;
  llm_location: string;
  dataplex_location: string;

  // Client Options Settings
  use_lineage_tables: boolean;
  use_lineage_processes: boolean;
  use_profile: boolean;
  use_data_quality: boolean;
  use_ext_documents: boolean;
  persist_to_dataplex_catalog: boolean;
  stage_for_review: boolean;
  top_values_in_description: boolean;
  description_handling: string;
  description_prefix: string;

  // Table Settings
  dataset_id: string;
  table_id: string;
  documentation_uri: string;

  // Dataset Settings
  documentation_csv_uri: string;
  strategy: string;
}

function App() {
  const [dataplexConfig, setDataplexConfig] = useState<DatplexConfig>({
    // Client Settings
    project_id: process.env.REACT_APP_PROJECT_ID || '',
    llm_location: process.env.REACT_APP_LLM_LOCATION || '',
    dataplex_location: process.env.REACT_APP_DATAPLEX_LOCATION || '',

    // Client Options Settings
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

    // Table Settings
    dataset_id: '',
    table_id: '',
    documentation_uri: '',

    // Dataset Settings
    documentation_csv_uri: '',
    strategy: 'NAIVE'
  });

  const [tasks, setTasks] = useState<Task[]>([]);

  const handleTaskAdd = (task: Task) => {
    setTasks(prev => [task, ...prev].slice(0, 50)); // Keep last 50 tasks
  };

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const theme = createTheme({
    palette: {
      mode: 'light',
    },
    typography: {
      h1: {
        fontSize: '2rem',
        fontWeight: 500,
        marginBottom: '1rem'
      },
      h2: {
        fontSize: '1.5rem',
        fontWeight: 500,
        marginBottom: '0.5rem'
      },
      h3: {
        fontSize: '1.25rem',
        fontWeight: 500
      },
      h4: {
        fontSize: '1.1rem',
        fontWeight: 500
      },
      h5: {
        fontSize: '1rem',
        fontWeight: 500
      },
      h6: {
        fontSize: '0.875rem',
        fontWeight: 500
      },
      body1: {
        fontSize: '0.875rem'
      },
      body2: {
        fontSize: '0.75rem'
      }
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontSize: '0.875rem'
          }
        }
      },
      MuiTextField: {
        defaultProps: {
          size: 'small'
        }
      },
      MuiFormControl: {
        defaultProps: {
          size: 'small'
        }
      }
    }
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <TopNavBar tasks={tasks} />
          <LeftMenu />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              mt: 8,
              width: { sm: `calc(100% - ${240}px)` },
              ml: { sm: `${240}px` }
            }}
          >
            <Routes>
              <Route 
                path="/" 
                element={<ConfigurationPage config={dataplexConfig} onConfigChange={setDataplexConfig} />} 
              />
              <Route 
                path="/review" 
                element={<ReviewPage config={dataplexConfig} />} 
              />
              <Route 
                path="/generate" 
                element={
                  <GenerationPage 
                    config={dataplexConfig} 
                    onTaskAdd={handleTaskAdd}
                    onTaskUpdate={handleTaskUpdate}
                  />
                } 
              />
              <Route 
                path="/configuration" 
                element={<ConfigurationPage config={dataplexConfig} onConfigChange={setDataplexConfig} />} 
              />
              <Route 
                path="/contracts" 
                element={<DataProductEvaluation />} 
              />
              <Route 
                path="/contracts/diagnostics" 
                element={<DiagnosticsOverview />} 
              />
              <Route 
                path="/contracts/diagnostics/:productId" 
                element={<DataProductDiagnostics />} 
              />
              <Route 
                path="/contracts/dashboard" 
                element={<SLADashboard />} 
              />
              <Route 
                path="/contracts/templates" 
                element={<ContractTemplates />} 
              />
              <Route 
                path="/contracts/compliance" 
                element={<ContractCompliance />} 
              />
              <Route 
                path="/contracts/sla-generator" 
                element={<SLAGenerator />} 
              />
              <Route 
                path="/contracts/terms" 
                element={<ContractTerms />} 
              />
              <Route 
                path="/compliance" 
                element={<ComplianceOverview />} 
              />
              <Route 
                path="/compliance/sensitivity" 
                element={<DataSensitivity />} 
              />
              <Route 
                path="/compliance/access" 
                element={<AccessPolicies />} 
              />
              <Route 
                path="/compliance/retention" 
                element={<RetentionPolicies />} 
              />
              <Route 
                path="/compliance/governance" 
                element={<GovernancePolicies />} 
              />
              <Route 
                path="/publishing" 
                element={<PublishingOverview />} 
              />
              <Route 
                path="/publishing/marketplaces" 
                element={<Marketplaces />} 
              />
              <Route 
                path="/publishing/history" 
                element={<PublishingHistory />} 
              />
              <Route 
                path="/publishing/destinations" 
                element={<PublishingDestinations />} 
              />
              <Route 
                path="/publishing/settings" 
                element={<PublishingSettings />} 
              />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
