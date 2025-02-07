import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Rating,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import TimelineIcon from '@mui/icons-material/Timeline';
import DescriptionIcon from '@mui/icons-material/Description';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import BugReportIcon from '@mui/icons-material/BugReport';
import UpdateIcon from '@mui/icons-material/Update';
import SchemaIcon from '@mui/icons-material/Schema';
import BuildIcon from '@mui/icons-material/Build';
import { useNavigate, useParams } from 'react-router-dom';

interface Recommendation {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
  action: string;
}

interface MetricScore {
  score: number;
  status: 'good' | 'warning' | 'critical';
  details: string[];
}

interface DataProductDiagnostics {
  id: string;
  name: string;
  description: string;
  owner: string;
  domain: string;
  lastUpdated: string;
  metrics: {
    sla: MetricScore;
    dataQuality: MetricScore;
    documentation: MetricScore;
    security: MetricScore;
    schema: MetricScore;
    lineage: MetricScore;
  };
  recommendations: Recommendation[];
}

const DataProductDiagnostics: React.FC = () => {
  const navigate = useNavigate();
  const { productId } = useParams();

  // In a real application, you would fetch the diagnostic data based on the productId
  // For now, we'll use mock data
  const diagnostics: DataProductDiagnostics = {
    id: productId || '1',
    name: 'Customer Analytics Dataset',
    description: 'Core dataset for customer behavior analysis',
    owner: 'Analytics Team',
    domain: 'Marketing',
    lastUpdated: '2024-03-10 15:30',
    metrics: {
      sla: {
        score: 85,
        status: 'warning',
        details: [
          'Availability SLA not met in last 24h',
          'Latency within acceptable range',
          'Data freshness needs improvement'
        ]
      },
      dataQuality: {
        score: 92,
        status: 'good',
        details: [
          'Completeness: 98%',
          'Accuracy: 95%',
          'Consistency: 94%',
          'Validity: 96%'
        ]
      },
      documentation: {
        score: 65,
        status: 'critical',
        details: [
          'Missing column descriptions',
          'Outdated business context',
          'No usage examples'
        ]
      },
      security: {
        score: 95,
        status: 'good',
        details: [
          'Access controls properly configured',
          'Encryption at rest enabled',
          'Regular security audits performed'
        ]
      },
      schema: {
        score: 88,
        status: 'warning',
        details: [
          'Some columns need type optimization',
          'Partition key could be improved',
          'Clustering keys well defined'
        ]
      },
      lineage: {
        score: 90,
        status: 'good',
        details: [
          'Complete upstream dependencies',
          'Impact analysis available',
          'Transform logic documented'
        ]
      }
    },
    recommendations: [
      {
        id: 'REC001',
        severity: 'high',
        category: 'Documentation',
        title: 'Incomplete Column Descriptions',
        description: 'Several critical columns are missing descriptions, impacting data usability.',
        impact: 'Reduced data discovery and understanding for consumers.',
        action: 'Add descriptions for missing columns, focusing on business context and usage.'
      },
      {
        id: 'REC002',
        severity: 'medium',
        category: 'SLA',
        title: 'Availability SLA Improvement',
        description: 'System availability dropped below target in last 24 hours.',
        impact: 'Potential disruption to dependent processes and applications.',
        action: 'Review and optimize data pipeline performance, implement better error handling.'
      },
      {
        id: 'REC003',
        severity: 'low',
        category: 'Schema',
        title: 'Schema Optimization',
        description: 'Current schema structure could be optimized for better query performance.',
        impact: 'Slightly increased query latency and storage costs.',
        action: 'Review column types and implement suggested partitioning strategy.'
      }
    ]
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Documentation':
        return <DescriptionIcon />;
      case 'SLA':
        return <SpeedIcon />;
      case 'Schema':
        return <SchemaIcon />;
      case 'Security':
        return <SecurityIcon />;
      case 'Data Quality':
        return <BugReportIcon />;
      default:
        return <BuildIcon />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('/contracts');
          }}
        >
          Data Products
        </Link>
        <Link
          color="inherit"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('/contracts/diagnostics');
          }}
        >
          Diagnostics
        </Link>
        <Typography color="text.primary">{diagnostics.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Data Product Diagnostics
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/contracts/diagnostics')}
          >
            Back to Diagnostics
          </Button>
        </Box>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Typography variant="h5">{diagnostics.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {diagnostics.description}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip label={diagnostics.domain} />
                <Typography variant="body2">
                  Owner: {diagnostics.owner}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                Last Updated: {diagnostics.lastUpdated}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* Overall Health Score */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Overall Health Score
        </Typography>
        <Grid container spacing={3}>
          {Object.entries(diagnostics.metrics).map(([key, metric]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {getStatusIcon(metric.status)}
                    <Typography variant="h6" component="div" sx={{ textTransform: 'capitalize' }}>
                      {key}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" component="div" sx={{ mr: 2 }}>
                      {metric.score}%
                    </Typography>
                    <Chip
                      label={metric.status}
                      color={getStatusColor(metric.status)}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={metric.score}
                    color={getStatusColor(metric.status)}
                    sx={{ mb: 2 }}
                  />
                  <List dense>
                    {metric.details.map((detail, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={detail}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Recommendations */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Improvement Recommendations
        </Typography>
        {diagnostics.recommendations.map((rec) => (
          <Accordion key={rec.id} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <ListItemIcon>
                  {getCategoryIcon(rec.category)}
                </ListItemIcon>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">{rec.title}</Typography>
                    <Chip
                      label={rec.severity}
                      color={getSeverityColor(rec.severity)}
                      size="small"
                    />
                    <Chip label={rec.category} size="small" />
                  </Box>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body1" paragraph>
                    {rec.description}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Impact</Typography>
                    {rec.impact}
                  </Alert>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Alert severity="info">
                    <Typography variant="subtitle2">Recommended Action</Typography>
                    {rec.action}
                  </Alert>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<BuildIcon />}
                >
                  Take Action
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>
    </Box>
  );
};

export default DataProductDiagnostics; 