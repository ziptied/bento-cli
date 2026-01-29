/**
 * Test setup file
 *
 * This file is preloaded before all tests run.
 * Use it to set up global mocks, environment variables, etc.
 */

// Ensure tests don't accidentally use real credentials
process.env.BENTO_API_KEY = "test-api-key";
process.env.BENTO_SITE_ID = "test-site-id";
