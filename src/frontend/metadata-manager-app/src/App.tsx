import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

// Components
import TopNavBar from './components/navigation/TopNavBar';
import SecondaryNavBar from './components/navigation/SecondaryNavBar';
import LeftSidebar from './components/navigation/LeftSidebar';

// Pages
import GenerationPage from './pages/GenerationPage';
import ReviewPage from './pages/ReviewPage';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#4285f4', // Google Blue
    },
    background: {
      default: '#ffffff',
      paper: '#f8f9fa',
    },
    text: {
      primary: '#202124',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    fontSize: 14,
    h1: {
      fontSize: '24px',
      fontWeight: 500,
    },
    h2: {
      fontSize: '16px',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginLeft: 240, // Width of the sidebar
  marginTop: 112, // Height of both nav bars
}));

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <TopNavBar />
          <SecondaryNavBar />
          <LeftSidebar />
          <MainContent>
            <Routes>
              <Route path="/" element={<GenerationPage />} />
              <Route path="/review" element={<ReviewPage />} />
            </Routes>
          </MainContent>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
