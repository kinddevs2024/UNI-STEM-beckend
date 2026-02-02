# Known Issues & Technical Debt

This document tracks known issues, bugs, and technical debt that should be addressed in future iterations. Items are categorized by priority and impact.

---

## ⚠️ Critical Issues (Must Fix Before Launch)

These issues should be addressed before production launch, especially for high-traffic scenarios.

### 1. normalizeTheme loses containerWidth

**Priority**: HIGH  
**Impact**: Data Loss Risk  
**Category**: Bug

**Description**:  
The `normalizeTheme` function in `portfolioThemes.js` doesn't preserve `containerWidth` when normalizing themes. The field is manually restored in `PortfolioView` and `PortfolioConstructor`, but this workaround could be bypassed if `normalizeTheme` is called directly elsewhere.

**Location**:  
- `UNI-STEM-Front/src/utils/portfolioThemes.js` - normalizeTheme function
- `UNI-STEM-Front/src/components/PortfolioView/PortfolioView.jsx` - Manual restoration
- `UNI-STEM-Front/src/components/PortfolioConstructor/PortfolioConstructor.jsx` - Manual restoration

**Current Workaround**:  
Container width is manually restored after normalization in components that use it.

**Recommended Fix**:  
Preserve `containerWidth` directly in the `normalizeTheme` function to ensure it's never lost, regardless of where the function is called.

**Risk if Not Fixed**:  
- Container width could be lost if normalizeTheme is called without manual restoration
- Data inconsistency if normalization happens in unexpected code paths

---

### 2. University Pagination Uses Client-Side Pagination

**Priority**: HIGH  
**Impact**: Performance  
**Category**: Architecture Issue

**Description**:  
The frontend uses `getPaginatedPortfolios()` to slice results on the client side, while the backend returns proper pagination metadata (page, limit, total, pages). This means all portfolios are loaded into memory before pagination occurs.

**Location**:  
- Frontend: `UNI-STEM-Front/src/pages/UniversityPanel/UniversityPanel.jsx`
- Backend: Returns pagination metadata but frontend ignores it

**Current Behavior**:  
1. Frontend fetches all portfolios matching filters
2. Frontend slices results for current page
3. Backend pagination metadata is unused

**Recommended Fix**:  
1. Use backend pagination by passing `page` and `limit` query parameters
2. Use backend pagination metadata to render pagination controls
3. Remove client-side slicing logic

**Performance Impact**:  
- **Current**: Loads all portfolios (could be thousands) into memory
- **With Fix**: Only loads one page of results (e.g., 20-50 portfolios)

**Risk if Not Fixed**:  
- High memory usage with large datasets
- Slow initial load times
- Potential browser crashes with very large datasets (> 10,000 portfolios)

---

### 3. Search Query Performance

**Priority**: HIGH  
**Impact**: Performance  
**Category**: Performance Issue

**Description**:  
When search is used, the backend fetches all matching portfolios, then filters in memory, then fetches all again for count. This is inefficient for large datasets.

**Location**:  
Backend portfolio query logic (likely in portfolio API endpoint)

**Current Behavior**:  
1. Fetch all portfolios matching base filters
2. Filter results in memory based on search query
3. Fetch all again to get count for pagination

**Recommended Fix**:  
1. Use MongoDB text indexes for search
2. Apply search filter in database query instead of in-memory
3. Use MongoDB aggregation pipeline for efficient counting

**Performance Impact**:  
- **Current**: O(n) in-memory filtering on all results
- **With Fix**: O(log n) database-indexed search

**Risk if Not Fixed**:  
- Slow search response times with large datasets
- High server memory usage
- Poor user experience during search operations

---

### 4. Container Width Padding Uses Hardcoded Values

**Priority**: MEDIUM  
**Impact**: Consistency  
**Category**: Code Quality

**Description**:  
`portfolio.css` uses hardcoded `2rem` padding in container width variants instead of using design tokens (`--spacing-base`) for consistency.

**Location**:  
`UNI-STEM-Front/src/styles/portfolio.css`

**Current Implementation**:  
```css
.portfolio-container[data-width="narrow"] {
  padding: 2rem;
}
```

**Recommended Fix**:  
Replace hardcoded values with design tokens:
```css
.portfolio-container[data-width="narrow"] {
  padding: var(--spacing-base);
}
```

**Risk if Not Fixed**:  
- Inconsistency if design tokens are updated
- Harder to maintain consistent spacing across the application
- Minor issue, but violates design system principles

---

## 🟡 Optional Improvements (Low Priority)

These issues are not blocking but represent technical debt that should be addressed in future iterations.

### 5. whileInView Animation Conflict

**Priority**: LOW  
**Impact**: UX (Minor Animation Issues)  
**Category**: Code Quality

**Description**:  
Non-owner sections use both `animate` and `whileInView` props, which may conflict and cause janky animations.

**Location**:  
Portfolio section components (non-owner view)

**Current Behavior**:  
Animations may conflict when both animation methods are used simultaneously.

**Recommended Fix**:  
Use only one animation method (prefer `whileInView` for scroll-triggered animations).

**Impact**:  
Minor - animations may occasionally appear janky, but functionality is not affected.

---

### 6. Hardcoded Spacing in Some Components

**Priority**: LOW  
**Impact**: Consistency  
**Category**: Code Quality

**Description**:  
Some components (InlineTextEditor, EmulatorBlock, CookieConsentModal) still use hardcoded `px` values instead of design tokens.

**Components Affected**:  
- `UNI-STEM-Front/src/components/InlineTextEditor/`
- `UNI-STEM-Front/src/components/EmulatorBlock/`
- `UNI-STEM-Front/src/components/CookieConsentModal/`

**Recommended Fix**:  
Migrate hardcoded spacing values to use design tokens gradually.

**Impact**:  
Low - functional impact is zero, but reduces design system consistency.

---

### 7. Search Filter Could Use MongoDB Text Indexes

**Priority**: LOW  
**Impact**: Performance (Future Optimization)  
**Category**: Optimization

**Description**:  
Current in-memory filtering works but could be optimized with MongoDB text search indexes for better performance at scale.

**Current Implementation**:  
In-memory filtering after database query.

**Recommended Fix**:  
1. Create MongoDB text indexes on searchable fields
2. Use `$text` query operator for search
3. Implement relevance scoring

**Impact**:  
Performance improvement would be significant with large datasets, but current implementation is acceptable for small to medium datasets.

---

### 8. Container Width Max-Width Values Could Be Tokens

**Priority**: LOW  
**Impact**: Maintainability  
**Category**: Code Quality

**Description**:  
The max-width values (800px, 1200px, 1600px) in `portfolio.css` could be design tokens for easier maintenance.

**Location**:  
`UNI-STEM-Front/src/styles/portfolio.css`

**Recommended Fix**:  
Extract max-width values to CSS custom properties in design tokens.

**Impact**:  
Low - easier to adjust container widths globally if needed.

---

### 9. Missing Error Handling for API Pagination

**Priority**: MEDIUM  
**Impact**: Error Handling  
**Category**: Robustness

**Description**:  
Frontend doesn't handle backend pagination response structure if it differs from expected format. Could cause crashes if backend response structure changes.

**Location**:  
Frontend pagination handling code

**Recommended Fix**:  
Add defensive error handling and validation for pagination response structure.

**Impact**:  
Medium - could cause application errors if backend response format changes unexpectedly.

---

## 📊 Summary

### By Priority

- **Critical (Must Fix)**: 4 issues
- **Optional Improvements**: 5 issues

### By Category

- **Performance**: 2 critical, 1 optional
- **Bugs**: 1 critical
- **Code Quality**: 1 critical, 4 optional
- **Architecture**: 1 critical
- **Error Handling**: 1 optional

### Recommended Action Plan

1. **Before Launch**: Address all 4 critical issues
2. **First Iteration**: Fix issue #9 (error handling)
3. **Future Iterations**: Address optional improvements as time permits

---

## 🔄 Issue Tracking

### Status Legend

- ⚠️ **Critical** - Must fix before launch
- 🟡 **Optional** - Should fix eventually
- ✅ **Fixed** - Issue resolved
- 🔄 **In Progress** - Currently being addressed

### Current Status

All issues listed above are currently **⚠️ Open** and documented for future resolution.

---

**Last Updated**: December 2024  
**Next Review**: After initial production deployment

