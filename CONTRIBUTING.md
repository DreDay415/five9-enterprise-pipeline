# Contributing to Five9 Enterprise Pipeline

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- Access to Five9 SFTP (for testing)
- OpenAI API key (for testing)
- Notion workspace (for testing)

### Initial Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd five9-enterprise-pipeline
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run the setup script**:
```bash
npm run setup-dev  # Coming soon
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: New features
- `fix/*`: Bug fixes
- `docs/*`: Documentation updates

### Making Changes

1. **Create a feature branch**:
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**:
   - Write code following our style guide
   - Add tests for new functionality
   - Update documentation as needed

3. **Run tests**:
```bash
npm test
```

4. **Run linter**:
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

5. **Run type checker**:
```bash
npm run typecheck
```

6. **Build the project**:
```bash
npm run build
```

7. **Commit your changes**:
```bash
git add .
git commit -m "feat: add amazing feature"
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples**:
```
feat: add retry logic to SFTP downloads
fix: handle rate limiting in OpenAI API
docs: update architecture documentation
test: add unit tests for transcription service
```

## Code Style Guide

### TypeScript

- Use strict TypeScript settings
- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` if necessary
- Use optional chaining and nullish coalescing

**Good**:
```typescript
async function processFile(filePath: string): Promise<TranscriptionResult> {
  const file = await readFile(filePath);
  return await transcribe(file);
}
```

**Bad**:
```typescript
async function processFile(filePath: any) {
  const file = await readFile(filePath);
  return await transcribe(file);
}
```

### Error Handling

- Use custom error classes
- Include context in errors
- Mark errors as retryable/non-retryable
- Log errors with appropriate level

**Good**:
```typescript
try {
  await downloadFile(path);
} catch (error) {
  throw SftpError.downloadFailed(
    path,
    error instanceof Error ? error : new Error(String(error))
  );
}
```

### Logging

- Use structured logging
- Include context (IDs, names)
- Use appropriate log levels
- Don't log sensitive data

**Good**:
```typescript
logger.info({ fileName, duration }, 'File processed successfully');
```

**Bad**:
```typescript
console.log('File processed: ' + fileName);
```

### Testing

- Write tests for all new code
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

**Example**:
```typescript
describe('TranscriptionService', () => {
  describe('transcribe', () => {
    it('should successfully transcribe a valid audio file', async () => {
      // Arrange
      const service = new TranscriptionService(config, retryOptions);
      const filePath = '/path/to/file.wav';
      
      // Act
      const result = await service.transcribe(filePath);
      
      // Assert
      expect(result.text).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
```

## Testing Requirements

### Unit Tests

- Required for all new services and utilities
- Minimum 70% code coverage
- Mock external dependencies
- Test edge cases and error scenarios

### Integration Tests

- Test service interactions
- Use test fixtures
- Clean up after tests

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Integration tests only
npm run test:integration

# With coverage
npm test -- --coverage
```

## Documentation

### Code Documentation

- Add JSDoc comments to all public functions
- Document parameters and return types
- Include examples for complex functions
- Explain "why" not just "what"

**Example**:
```typescript
/**
 * Transcribe an audio file using OpenAI Whisper API
 * 
 * @param filePath - Path to the audio file
 * @returns Transcription result with text, duration, and segments
 * @throws TranscriptionError if file is invalid or API fails
 * 
 * @example
 * ```typescript
 * const result = await service.transcribe('/path/to/audio.wav');
 * console.log(result.text);
 * ```
 */
async transcribe(filePath: string): Promise<TranscriptionResult>
```

### Documentation Files

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for design changes
- Create new docs in `docs/` folder for complex topics

## Pull Request Process

1. **Ensure all tests pass**:
```bash
npm test
npm run lint
npm run typecheck
npm run build
```

2. **Update documentation**:
   - README.md if user-facing
   - ARCHITECTURE.md if design changes
   - CHANGELOG.md with your changes

3. **Create a Pull Request**:
   - Use a descriptive title
   - Reference related issues
   - Describe what changed and why
   - Include screenshots if UI changes

4. **Code Review**:
   - Address review comments
   - Keep discussions focused
   - Be open to feedback

5. **Merge**:
   - Squash commits if many small commits
   - Use merge commit for feature branches
   - Delete branch after merge

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. CI/CD will build and publish

## Getting Help

- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: [Contact email]

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md
- CHANGELOG.md
- Release notes

Thank you for contributing! 🎉
