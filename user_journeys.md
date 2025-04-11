# User Journeys for Table Review Operations

## Overview

This document describes the user journeys for reviewing and managing metadata in tables and their columns. It focuses on the table review operations, including navigation between items, caching mechanisms, preloading strategies, and refresh behaviors.

## Primary User Journeys

### Journey 1: Browsing Items in List View

1. **Initial Load**
   - User navigates to the Review Page
   - Application fetches a list of review items via `fetchReviewItems()`
   - Items are displayed in list mode by default
   - Basic metadata (name, status, type) is shown without detailed content

2. **Scrolling Through List**
   - As user scrolls down the list, the application detects when they are near the bottom
   - When close to the bottom (within 300px), preloading is triggered for items that will soon be visible
   - Preloading mechanism marks items for background loading using `setItemToPreload()`
   - This ensures that detailed item data will be available when the user scrolls to them

3. **Refresh Operation**
   - User can refresh the item list by clicking the refresh button
   - This triggers `handleRefresh()` which clears existing data and reloads items
   - The refresh operation provides visual feedback with loading indicators

### Journey 2: Navigating Between Review Items

1. **Entering Review Mode**
   - User clicks on an item in the list or toggles to review mode
   - Application loads detailed item information via `loadItemDetails()`
   - If details are already cached, they are retrieved from cache instead of making a new API call
   - The view changes to show detailed information for the selected item

2. **Next/Previous Navigation**
   - User navigates between items using Next/Previous buttons or keyboard shortcuts (ArrowRight/ArrowLeft or j/k)
   - These actions trigger `handleNext()` or `handlePrevious()` respectively
   - When moving to the next item:
     - Application updates the current index
     - Loads details for the new item if not already cached
     - Preloads the next 1-2 items in sequence to minimize wait times
   - When moving to the previous item:
     - Application updates the current index
     - Uses cached data if available or loads from the API if needed

3. **Table-Column Navigation**
   - When viewing a table, user can drill down into its columns
   - When viewing a column, user can navigate back to its parent table
   - Navigation between columns within the same table is tracked via `currentColumnIndex`
   - `handleNextColumn()` and `handlePrevColumn()` enable navigation between columns
   - `handleBackToTable()` returns to the parent table view from a column view

### Journey 3: Viewing and Editing Content

1. **Viewing Item Details**
   - Application displays current and draft descriptions side by side
   - User can toggle between difference view and side-by-side view
   - Comments associated with the item are displayed in chronological order

2. **Editing Content**
   - User can edit content by clicking the edit button
   - This opens a dialog with either a plain text field or rich text editor
   - Content changes are managed through state (`useState`) and submitted via API

3. **Accepting Changes**
   - User can accept the draft description by clicking the accept button
   - This triggers `handleAccept()` which updates the status to 'accepted'
   - Changes are saved to the backend and the UI is updated to reflect new status

## Caching and Preloading Mechanisms

### Caching Strategy

1. **Cache Implementation**
   - Caching is managed through `CacheContext` which provides:
     - `detailsCache`: Stores item details indexed by item ID
     - `setDetailsCache`: Function to update the cache
     - `clearCache`: Function to clear all cached data
   
2. **Cache Storage**
   - Cache is persisted in localStorage with key `metadata_details_cache`
   - Cache expiry is controlled by a timestamp (30-minute expiry by default)
   - On application load, the cache is restored if it hasn't expired

3. **Cache Usage**
   - Before loading item details, the application checks if data exists in cache
   - If cache hit occurs, cached data is used instead of making API request
   - Cache is updated whenever new data is fetched

### Preloading Strategy

1. **Automatic Preloading**
   - When a user navigates to an item, the next 1-2 items are preloaded
   - `preloadNextItem()` function handles this by loading data for upcoming items
   - Preloaded data is stored in cache and used when the user navigates forward

2. **Scroll-Based Preloading**
   - When scrolling in list view, items that will soon be visible are preloaded
   - Application detects when user is near the bottom of the scroll container
   - Items just beyond the visible area are marked for preloading
   - This is handled by setting `itemToPreload` state which triggers a useEffect

3. **Background Loading**
   - Preloading happens in the background without interrupting the user experience
   - `loadItemDetails()` has a parameter to control whether loading indicators are shown
   - For preloaded items, no loading indicators are displayed

## Refresh Operations

1. **Manual Refresh**
   - User can manually refresh data by clicking the refresh button
   - This triggers complete reload of the current item's details
   - Cache for the refreshed item is updated

2. **Background Refresh**
   - Some operations trigger a background refresh without navigation
   - `backgroundRefreshWithoutNavigation()` updates item data without changing view
   - This happens after edits, comments, or status changes 

3. **Cache Invalidation**
   - When user makes changes (edits, accepts changes, adds comments), affected cache entries are updated
   - In some cases, the entire cache may be cleared to ensure fresh data

## Performance Considerations

1. **Minimizing API Calls**
   - Extensive use of caching to reduce API calls
   - Preloading of adjacent items to ensure smooth navigation
   - Background loading to avoid user-visible delays

2. **Loading States**
   - Visual indicators (CircularProgress) show when data is being loaded
   - Background operations avoid showing loading indicators
   - Error states are handled and displayed to the user when needed

3. **Optimizing User Experience**
   - Keyboard shortcuts for faster navigation (j/k and arrow keys)
   - Immediate UI updates before API calls complete (optimistic updates)
   - Cached data is shown instantly while refreshes happen in the background

## Edge Cases and Error Handling

1. **Cache Integrity**
   - Function `verifyCacheIntegrity()` checks that cached data is valid
   - If cache corruption is detected, cache is cleared and data reloaded

2. **Network Failures**
   - API call errors are caught and displayed to the user
   - Application continues to function with cached data when possible

3. **State Synchronization**
   - Multiple checks ensure that UI state matches the underlying data
   - Complex state tracking for table/column relationships 