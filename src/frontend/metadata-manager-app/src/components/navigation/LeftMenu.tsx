import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Toolbar,
  Collapse,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SpeedIcon from '@mui/icons-material/Speed';
import DescriptionIcon from '@mui/icons-material/Description';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import DataObjectIcon from '@mui/icons-material/DataObject';
import SecurityIcon from '@mui/icons-material/Security';
import PolicyIcon from '@mui/icons-material/Policy';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import GavelIcon from '@mui/icons-material/Gavel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

const drawerWidth = 240;

const configItems = [
  {
    text: 'Configuration',
    icon: <SettingsIcon />,
    path: '/configuration'
  }
];

const metadataSubItems = [
  {
    text: 'Generate',
    icon: <AutoFixHighIcon />,
    path: '/generate'
  },
  {
    text: 'Review',
    icon: <RateReviewIcon />,
    path: '/review'
  }
];

const contractSubItems = [
  {
    text: 'Data Products',
    icon: <SearchIcon />,
    path: '/contracts'
  },
  {
    text: 'Diagnostics Overview',
    icon: <AssessmentIcon />,
    path: '/contracts/diagnostics'
  },
  {
    text: 'SLA Dashboard',
    icon: <SpeedIcon />,
    path: '/contracts/dashboard'
  },
  {
    text: 'Templates',
    icon: <DescriptionIcon />,
    path: '/contracts/templates'
  },
  {
    text: 'SLA Generator',
    icon: <AccountTreeIcon />,
    path: '/contracts/sla-generator'
  },
  {
    text: 'Terms & Versioning',
    icon: <HistoryIcon />,
    path: '/contracts/terms'
  }
];

const complianceSubItems = [
  {
    text: 'Compliance Overview',
    icon: <GavelIcon />,
    path: '/compliance'
  },
  {
    text: 'Data Sensitivity',
    icon: <SecurityIcon />,
    path: '/compliance/sensitivity'
  },
  {
    text: 'Access Policies',
    icon: <LockIcon />,
    path: '/compliance/access'
  },
  {
    text: 'Retention Policies',
    icon: <DeleteIcon />,
    path: '/compliance/retention'
  },
  {
    text: 'Governance Policies',
    icon: <PolicyIcon />,
    path: '/compliance/governance'
  }
];

const publishingSubItems = [
  {
    text: 'Publishing Overview',
    icon: <CloudUploadIcon />,
    path: '/publishing'
  },
  {
    text: 'Marketplaces',
    icon: <StorefrontIcon />,
    path: '/publishing/marketplaces'
  },
  {
    text: 'Publishing History',
    icon: <HistoryIcon />,
    path: '/publishing/history'
  },
  {
    text: 'Destinations',
    icon: <CompareArrowsIcon />,
    path: '/publishing/destinations'
  },
  {
    text: 'Publishing Settings',
    icon: <SettingsApplicationsIcon />,
    path: '/publishing/settings'
  }
];

const LeftMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [contractsOpen, setContractsOpen] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(true);
  const [complianceOpen, setComplianceOpen] = useState(true);
  const [publishingOpen, setPublishingOpen] = useState(true);

  const handleContractsClick = () => {
    setContractsOpen(!contractsOpen);
  };

  const handleMetadataClick = () => {
    setMetadataOpen(!metadataOpen);
  };

  const handleComplianceClick = () => {
    setComplianceOpen(!complianceOpen);
  };

  const handlePublishingClick = () => {
    setPublishingOpen(!publishingOpen);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {configItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'inherit' : 'primary.main' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}

          {/* Metadata Section with Submenu */}
          <ListItem disablePadding>
            <ListItemButton onClick={handleMetadataClick}>
              <ListItemIcon sx={{ color: 'primary.main' }}>
                <DataObjectIcon />
              </ListItemIcon>
              <ListItemText primary="Metadata" />
              {metadataOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>

          <Collapse in={metadataOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {metadataSubItems.map((item) => (
                <ListItemButton
                  key={item.text}
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: location.pathname === item.path ? 'inherit' : 'primary.main' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* Data Contracts Section with Submenu */}
          <ListItem disablePadding>
            <ListItemButton onClick={handleContractsClick}>
              <ListItemIcon sx={{ color: 'primary.main' }}>
                <HandshakeIcon />
              </ListItemIcon>
              <ListItemText primary="Data Contracts" />
              {contractsOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>

          <Collapse in={contractsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {contractSubItems.map((item) => (
                <ListItemButton
                  key={item.text}
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: location.pathname === item.path ? 'inherit' : 'primary.main' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* Compliance Section */}
          <ListItem disablePadding>
            <ListItemButton onClick={handleComplianceClick}>
              <ListItemIcon sx={{ color: 'primary.main' }}>
                <GavelIcon />
              </ListItemIcon>
              <ListItemText primary="Compliance" />
              {complianceOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>

          <Collapse in={complianceOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {complianceSubItems.map((item) => (
                <ListItemButton
                  key={item.text}
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: location.pathname === item.path ? 'inherit' : 'primary.main' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* Publishing Section */}
          <ListItem disablePadding>
            <ListItemButton onClick={handlePublishingClick}>
              <ListItemIcon sx={{ color: 'primary.main' }}>
                <CloudUploadIcon />
              </ListItemIcon>
              <ListItemText primary="Publishing" />
              {publishingOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>

          <Collapse in={publishingOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {publishingSubItems.map((item) => (
                <ListItemButton
                  key={item.text}
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: location.pathname === item.path ? 'inherit' : 'primary.main' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </List>
        <Divider />
      </Box>
    </Drawer>
  );
};

export default LeftMenu; 