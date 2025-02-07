import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Rating,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  LinearProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoIcon from '@mui/icons-material/Info';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StorageIcon from '@mui/icons-material/Storage';
import VerifiedIcon from '@mui/icons-material/Verified';
import DomainIcon from '@mui/icons-material/Domain';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useNavigate } from 'react-router-dom';

interface DataProduct {
  id: string;
  name: string;
  type: string;
  owner: string;
  domain: string;
  ratings: {
    dataQuality: number;
    latency: number;
    reliability: number;
    completeness: number;
    freshness: number;
  };
  slaViolations: number;
  lastUpdated: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

const DataProductEvaluation: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  // Mock domains data
  const domains = [
    'Marketing',
    'Sales',
    'Finance',
    'Operations',
    'Customer Service',
    'Product'
  ];

  // Mock data for demonstration
  const allDataProducts: DataProduct[] = [
    {
      id: '1',
      name: 'Customer Analytics Dataset',
      type: 'BigQuery Table',
      owner: 'Analytics Team',
      domain: 'Marketing',
      ratings: {
        dataQuality: 4.5,
        latency: 5,
        reliability: 4.8,
        completeness: 4.2,
        freshness: 4.7
      },
      slaViolations: 0,
      lastUpdated: '2024-03-10 15:30',
      status: 'healthy',
      trend: 'up'
    },
    {
      id: '2',
      name: 'Sales Transactions',
      type: 'BigQuery Table',
      owner: 'Sales Team',
      domain: 'Sales',
      ratings: {
        dataQuality: 3.8,
        latency: 3.5,
        reliability: 4.0,
        completeness: 3.9,
        freshness: 3.5
      },
      slaViolations: 2,
      lastUpdated: '2024-03-10 14:45',
      status: 'warning',
      trend: 'down'
    },
    {
      id: '3',
      name: 'Product Inventory',
      type: 'BigQuery View',
      owner: 'Product Team',
      domain: 'Product',
      ratings: {
        dataQuality: 4.2,
        latency: 4.5,
        reliability: 4.3,
        completeness: 4.0,
        freshness: 4.1
      },
      slaViolations: 1,
      lastUpdated: '2024-03-10 13:15',
      status: 'healthy',
      trend: 'stable'
    },
    {
      id: '4',
      name: 'Financial Reports',
      type: 'BigQuery Table',
      owner: 'Finance Team',
      domain: 'Finance',
      ratings: {
        dataQuality: 4.7,
        latency: 4.2,
        reliability: 4.9,
        completeness: 4.8,
        freshness: 4.5
      },
      slaViolations: 0,
      lastUpdated: '2024-03-10 12:30',
      status: 'healthy',
      trend: 'up'
    }
  ];

  // Filter data products based on selected domain and search query
  const filteredDataProducts = allDataProducts.filter(product => {
    const matchesDomain = selectedDomain === 'all' || product.domain === selectedDomain;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.owner.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  // Calculate domain-specific statistics
  const getDomainStats = (products: DataProduct[]) => {
    const total = products.length;
    const healthy = products.filter(p => p.status === 'healthy').length;
    const violations = products.reduce((sum, p) => sum + p.slaViolations, 0);
    const avgQuality = products.reduce((sum, p) => sum + p.ratings.dataQuality, 0) / total;
    
    return { total, healthy, violations, avgQuality };
  };

  const stats = getDomainStats(filteredDataProducts);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon color="success" />;
      case 'down':
        return <TrendingDownIcon color="error" />;
      default:
        return null;
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRowClick = (productId: string) => {
    navigate(`/contracts/diagnostics/${productId}`);
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
        <Typography color="text.primary">Evaluation</Typography>
      </Breadcrumbs>

      {/* Header with Search and Domain Filter */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Data Product Evaluation
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search data products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Domain</InputLabel>
              <Select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                label="Domain"
                startAdornment={
                  <InputAdornment position="start">
                    <DomainIcon />
                  </InputAdornment>
                }
              >
                <MenuItem value="all">All Domains</MenuItem>
                {domains.map(domain => (
                  <MenuItem key={domain} value={domain}>{domain}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Overall Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography color="textSecondary">
                  {selectedDomain === 'all' ? 'Total Data Products' : `${selectedDomain} Products`}
                </Typography>
              </Box>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <VerifiedIcon color="success" />
                <Typography color="textSecondary">Healthy Products</Typography>
              </Box>
              <Typography variant="h4">{stats.healthy}</Typography>
              <Typography variant="body2" color="success.main">
                {stats.total > 0 ? `${Math.round((stats.healthy / stats.total) * 100)}% of total` : '0% of total'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTimeIcon color="warning" />
                <Typography color="textSecondary">SLA Violations (24h)</Typography>
              </Box>
              <Typography variant="h4">{stats.violations}</Typography>
              <Typography variant="body2" color="warning.main">
                {filteredDataProducts.filter(p => p.slaViolations > 0).length} products affected
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StarIcon color="primary" />
                <Typography color="textSecondary">Average Quality Score</Typography>
              </Box>
              <Typography variant="h4">{stats.avgQuality.toFixed(1)}</Typography>
              <Rating value={stats.avgQuality} precision={0.1} readOnly size="small" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Products Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Product</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell align="center">Quality Score</TableCell>
                <TableCell align="center">Latency</TableCell>
                <TableCell align="center">Reliability</TableCell>
                <TableCell align="center">Completeness</TableCell>
                <TableCell align="center">Freshness</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Trend</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDataProducts
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((product) => (
                <TableRow 
                  key={product.id}
                  sx={{ 
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">{product.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {product.type}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Owner: {product.owner}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={product.domain} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Rating
                        value={product.ratings.dataQuality}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2">
                        {product.ratings.dataQuality.toFixed(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Rating
                        value={product.ratings.latency}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2">
                        {product.ratings.latency.toFixed(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Rating
                        value={product.ratings.reliability}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2">
                        {product.ratings.reliability.toFixed(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Rating
                        value={product.ratings.completeness}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2">
                        {product.ratings.completeness.toFixed(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Rating
                        value={product.ratings.freshness}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2">
                        {product.ratings.freshness.toFixed(1)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={product.status}
                        size="small"
                        color={getStatusColor(product.status)}
                      />
                      {product.slaViolations > 0 && (
                        <Tooltip title={`${product.slaViolations} SLA violations in last 24h`}>
                          <InfoIcon color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {getTrendIcon(product.trend)}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<AssessmentIcon />}
                      onClick={() => handleRowClick(product.id)}
                    >
                      Diagnose
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredDataProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default DataProductEvaluation; 