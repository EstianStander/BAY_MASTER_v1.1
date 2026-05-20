# Architecture Guide

## Overview

This application follows a **layered architecture** pattern with clear separation of concerns:

```
Client → Routes → Controllers → Services → Models → Database
```

## Layers

### 1. Routes Layer (`src/routes/`)
- **Purpose**: Define API endpoints and HTTP methods
- **Responsibilities**: 
  - Map URLs to controller functions
  - Apply middleware (auth, validation)
  - Group related endpoints

### 2. Controllers Layer (`src/controllers/`)
- **Purpose**: Handle HTTP requests and responses
- **Responsibilities**:
  - Extract data from requests
  - Call appropriate services
  - Format and send responses
  - Should be thin - business logic goes in services

### 3. Services Layer (`src/services/`)
- **Purpose**: Business logic and data manipulation
- **Responsibilities**:
  - Implement core business rules
  - Orchestrate multiple model operations
  - Handle complex operations
  - Reusable across different controllers

### 4. Models Layer (`src/models/`)
- **Purpose**: Data structure and database interaction
- **Responsibilities**:
  - Define database schemas
  - Data validation
  - Instance methods
  - Static methods for queries

### 5. Middleware Layer (`src/middleware/`)
- **Purpose**: Request/response processing
- **Responsibilities**:
  - Authentication/authorization
  - Request validation
  - Error handling
  - Rate limiting
  - Logging

## Data Flow

### Request Flow
```
1. Client sends request
2. Express receives request
3. Middleware processes (auth, validation, etc.)
4. Route matches and calls controller
5. Controller calls service
6. Service interacts with model
7. Model queries database
8. Response flows back through layers
9. Error handler catches any errors
```

### Example: User Registration
```javascript
// 1. Route (routes/authRoutes.js)
router.post('/register', validate(authValidation.register), authController.register);

// 2. Controller (controllers/authController.js)
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
});

// 3. Service (services/authService.js)
async register(userData) {
  // Business logic: check if user exists, create user, generate token
  const user = await User.create(userData);
  const token = this.generateToken(user._id);
  return { user, token };
}

// 4. Model (models/User.js)
const user = await User.create(userData); // Mongoose saves to DB
```

## Design Patterns

### 1. **Singleton Pattern**
Services are exported as single instances:
```javascript
class AuthService { ... }
module.exports = new AuthService();
```

### 2. **Dependency Injection**
Services receive dependencies through constructor or function parameters.

### 3. **Middleware Pattern**
Chain of responsibility for request processing.

### 4. **Factory Pattern**
Model creation and validation through Mongoose schemas.

## Best Practices

### Controllers
- Keep them thin
- Only handle HTTP concerns
- Don't put business logic here
- Use asyncHandler to avoid try-catch blocks

### Services
- Single Responsibility Principle
- Pure business logic
- Should be testable without HTTP context
- Can call other services

### Models
- Define clear schemas
- Use validators
- Create useful instance/static methods
- Keep database concerns here

### Error Handling
- Use custom AppError class
- Let errors bubble up to error handler
- Provide meaningful error messages
- Log errors appropriately

## Scaling Considerations

### Horizontal Scaling
- Stateless design (JWT instead of sessions)
- No server-side session storage
- Database connection pooling

### Vertical Scaling
- Async/await for non-blocking operations
- Database indexing
- Caching strategies (add Redis later)

### Modularity
- Easy to extract services into microservices
- Clear boundaries between layers
- Independent modules for different features

## Adding New Features

### Step-by-step:
1. **Create Model** - Define data structure
2. **Create Service** - Implement business logic
3. **Create Controller** - Handle HTTP requests
4. **Create Routes** - Define endpoints
5. **Add Validation** - Validate requests
6. **Write Tests** - Test each layer
7. **Update Documentation** - Document API

## Testing Strategy

- **Unit Tests**: Services and utility functions
- **Integration Tests**: API endpoints
- **Mock**: Database and external services in unit tests
