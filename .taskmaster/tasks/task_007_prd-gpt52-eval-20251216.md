# Task ID: 7

**Title:** Implement repository tree fetcher and module classifier

**Status:** done

**Dependencies:** 6 ✓

**Priority:** high

**Description:** Fetch complete repo structure and classify modules by type

**Details:**

Recursive GraphQL tree query for files up to 100 levels. Integrate @github-linguist v9.3.1 for language detection. Module classification logic: parse file paths/extensions, detect patterns (*/components/*, */services/*, etc.). Support JS/TS/Python/Go/Rust/Java.

**Test Strategy:**

Test with real GitHub mock repos. Verify tree completeness and classification accuracy against known repos.
