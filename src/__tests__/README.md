# Unit Tests for Kukai

This directory contains unit tests for the Kukai application. The tests are written using Jest and are organized by module type.

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- src/__tests__/utils/AnimationUtils.test.js
```

To run tests with coverage:

```bash
npm test -- --coverage
```

## Test Structure

The tests are organized by module type:

- `utils/`: Tests for utility functions
- `services/`: Tests for service modules
- `components/`: Tests for React components (to be added)
- `hooks/`: Tests for custom React hooks (to be added)

## Writing Tests

### Mocking Dependencies

For modules with external dependencies, create a mock file with the same name as the test file but with `.mock.js` extension. For example:

- `AnimationUtils.test.js` has a corresponding `AnimationUtils.mock.js`
- `NotificationService.test.js` has a corresponding `NotificationService.mock.js`

### Test Format

Each test file should follow this format:

```javascript
// Import mocks first (if needed)
import './SomeModule.mock';

// Import dependencies
import { functionToTest } from '../../path/to/module';

describe('ModuleName', () => {
  // Setup before each test
  beforeEach(() => {
    // Reset mocks, initialize test data, etc.
  });

  // Test cases
  test('should do something specific', () => {
    // Setup
    const input = 'test input';
    
    // Execute
    const result = functionToTest(input);
    
    // Verify
    expect(result).toBe('expected output');
  });
});
```

### Testing Async Functions

For async functions, use async/await:

```javascript
test('should handle async operations', async () => {
  // Setup
  const input = 'test input';
  
  // Execute
  const result = await asyncFunctionToTest(input);
  
  // Verify
  expect(result).toBe('expected output');
});
```

## Adding New Tests

1. Identify a module to test
2. Create a test file in the appropriate directory
3. If needed, create a mock file for external dependencies
4. Write tests following the format above
5. Run the tests to ensure they pass

## Best Practices

1. Test one thing per test case
2. Use descriptive test names that explain what is being tested
3. Follow the "Arrange-Act-Assert" pattern (Setup-Execute-Verify)
4. Mock external dependencies to isolate the code being tested
5. Keep tests simple and focused
6. Use comments to explain complex test setups or assertions 