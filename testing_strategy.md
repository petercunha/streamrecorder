# 🧪 Testing Strategy for TwitchRecorder

> Comprehensive testing plan for the Next.js Twitch stream recording webapp.

---

## 📊 Codebase Overview

| Aspect | Details |
|--------|---------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | SQLite (better-sqlite3) |
| **UI** | React 19 + Tailwind CSS + ShadCN UI |
| **External Dependencies** | streamlink-cli (system binary) |

---

## 🎯 Testing Needs Identified

### 1. **Model Layer** (`src/lib/models/`) — **HIGH PRIORITY**

Database access layer with SQL queries and business logic.

| Model | Test Coverage Needed |
|-------|---------------------|
| `StreamerModel` | CRUD operations, username normalization, soft-delete |
| `RecordingModel` | Complex filtering, pagination, status transitions, aggregations |
| `StatsModel` | Singleton pattern, recalculation logic, byte formatting |
| `RecordingLogModel` | Log creation, filtering by level, cleanup |

**Why Critical:**
- Direct database interaction
- Complex SQL queries with dynamic filters
- Aggregation functions that calculate stats

---

### 2. **Service Layer** (`src/lib/services/recording-service.ts`) — **CRITICAL PRIORITY**

Most complex component with external process management.

**Test Areas:**

| Function | Complexity | Risk Level |
|----------|------------|------------|
| `startRecording()` | High (spawns processes) | 🔴 Critical |
| `stopRecording()` | Medium (process signals) | 🔴 Critical |
| `checkIfLive()` | Medium (external API) | 🟡 High |
| `getStreamMetadata()` | Medium (external API) | 🟡 High |
| `checkAndRecordStreamers()` | High (concurrency) | 🔴 Critical |
| `shutdown()` | High (graceful cleanup) | 🔴 Critical |
| `handleRecordingEnd()` | Medium (state management) | 🟡 High |

**Key Testing Challenges:**
- Mocking `child_process.spawn` for streamlink
- Simulating process events (close, error, data)
- Testing concurrent recording scenarios
- Race condition prevention
- EventEmitter integration

---

### 3. **API Routes** (`src/app/api/`) — **HIGH PRIORITY**

RESTful endpoints with validation and error handling.

| Route | Methods | Test Focus |
|-------|---------|------------|
| `/api/streamers` | GET, POST | Validation, duplicates, avatar fetch |
| `/api/streamers/[id]` | GET, PATCH, DELETE | 404 handling, partial updates |
| `/api/recordings` | GET | Query param parsing, filters |
| `/api/recordings/[id]` | GET, DELETE | Resource not found |
| `/api/recordings/active` | GET | Status filtering |
| `/api/recordings/start/[id]` | POST | Conflict detection, service integration |
| `/api/recordings/stop/[id]` | POST | Not-recording handling |
| `/api/stats` | GET | Aggregation accuracy |
| `/api/logs` | GET | Limit parameter handling |
| `/api/service/check` | POST | Async trigger |
| `/api/service/status` | GET | Service state |

---

### 4. **Database Layer** (`src/lib/db.ts`) — **MEDIUM PRIORITY**

Schema initialization and migrations.

**Test Areas:**
- Table creation
- Migration handling (e.g., `avatar_url` column)
- WAL mode configuration
- Connection management

---

### 5. **Instrumentation** (`src/instrumentation.ts`) — **MEDIUM PRIORITY**

Server lifecycle management.

**Test Areas:**
- `register()` function
- `cleanupOrphanedRecordings()` - converts 'recording' → 'stopped'
- Graceful shutdown handlers
- SIGTERM/SIGINT handling

---

### 6. **UI Components** (`src/app/components/`) — **LOWER PRIORITY**

React components with data fetching.

**Test Areas:**
- `StatsCards` - polling, loading states, error handling
- `ActivityLogs` - real-time updates
- `StreamersList` - CRUD operations

---

## 🏗️ Recommended Testing Architecture

### Testing Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Test Runner | **Vitest** | Fast, native TS support, Vite integration |
| React Testing | **@testing-library/react** | Component testing |
| Mocking | **vi.mock()** | Module mocking |
| Database | **In-memory SQLite** | Isolated test DB |
| E2E (optional) | **Playwright** | Full workflow testing |

### Directory Structure

```
src/
├── lib/
│   ├── models/
│   │   ├── __tests__/              # Model unit tests
│   │   │   ├── streamer.test.ts
│   │   │   ├── recording.test.ts
│   │   │   ├── stats.test.ts
│   │   │   └── recording-log.test.ts
│   │   └── ... (source files)
│   ├── services/
│   │   ├── __tests__/
│   │   │   └── recording-service.test.ts
│   │   └── recording-service.ts
│   └── db.ts
├── app/
│   └── api/
│       └── __tests__/              # API integration tests
│           └── api.test.ts
└── ... 
tests/
├── integration/                    # E2E workflows
│   └── recording-lifecycle.test.ts
├── setup.ts                        # Vitest setup
└── utils/
    ├── test-db.ts                  # Test database helpers
    ├── mock-streamlink.ts          # Streamlink mocking
    └── mock-request.ts             # NextRequest builders
```

---

## 📝 Detailed Implementation Plan

### Phase 1: Foundation (Setup + Model Tests)

#### 1.1 Install Dependencies

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react jsdom @testing-library/jest-dom
```

#### 1.2 Configure Vitest (`vitest.config.ts`)

Key configuration requirements:
- TypeScript support
- React plugin
- Test database setup/teardown
- Module path aliases (`@/*`)

#### 1.3 Test Database Utilities (`tests/utils/test-db.ts`)

Key features:
- In-memory SQLite database
- Automatic schema initialization
- Transaction isolation per test
- Seed data helpers
- Cleanup between tests

#### 1.4 Model Unit Tests

Priority order:
1. `streamer.test.ts` - Simplest CRUD
2. `recording-log.test.ts` - Basic logging
3. `stats.test.ts` - Calculations
4. `recording.test.ts` - Complex filters

**Success Criteria:**
- 100% model coverage
- All CRUD operations tested
- Filter/pagination logic verified
- Edge cases (empty results, null values)

---

### Phase 2: Service Layer Tests (Most Complex)

#### 2.1 Streamlink Mocking Utility (`tests/utils/mock-streamlink.ts`)

Mock `child_process.spawn` to simulate:
- Stream is live (returns JSON with metadata)
- Stream is offline (returns error)
- Network timeout
- Invalid JSON response
- Process error events

#### 2.2 Recording Service Tests

Organize by functionality:

```
recording-service.test.ts
├── Lifecycle Management
│   ├── startAutoChecker() - interval setup
│   └── stopAutoChecker() - cleanup
├── Stream Detection
│   ├── checkIfLive() - live stream
│   ├── checkIfLive() - offline stream
│   └── getStreamMetadata() - metadata extraction
├── Recording Control
│   ├── startRecording() - success
│   ├── startRecording() - already recording
│   ├── startRecording() - streamer not found
│   ├── stopRecording() - graceful stop
│   └── stopRecording() - force kill after timeout
├── Auto-Recording
│   ├── checkAndRecordStreamers() - finds live streamers
│   ├── checkAndRecordStreamers() - prevents concurrent checks
│   └── checkAndRecordStreamers() - race condition handling
└── Shutdown
    ├── shutdown() - stops all recordings
    ├── shutdown() - updates database
    └── handleRecordingEnd() - cleanup
```

**Testing Approach:**
- Use `vi.mock('child_process')` for spawn mocking
- Mock `fs` module for file operations
- Spy on `RecordingModel` methods
- Test EventEmitter events

---

### Phase 3: API Route Tests

#### 3.1 Request/Response Helpers (`tests/utils/mock-request.ts`)

Build NextRequest objects with:
- Query parameters
- JSON body
- URL parsing
- Headers

#### 3.2 Route Handler Tests

Pattern for each route:

```typescript
describe('GET /api/streamers', () => {
  it('returns all active streamers by default');
  it('returns inactive streamers when ?all=true');
  it('handles database errors');
});
```

**Critical API Tests:**

| Route | Key Test Scenarios |
|-------|-------------------|
| POST `/api/streamers` | Validation, duplicate detection, avatar fetch failure handling |
| PATCH `/api/streamers/[id]` | Partial updates, 404 handling |
| POST `/api/recordings/start/[id]` | Conflict (409) when already recording |
| POST `/api/recordings/stop/[id]` | 409 when not recording |
| DELETE `/api/recordings/[id]` | Cascade behavior |

---

### Phase 4: Integration Tests

#### 4.1 Database Integration

- Migration runs correctly
- Foreign key constraints work
- WAL mode enabled

#### 4.2 Recording Lifecycle E2E

Full workflow:
1. Create streamer with auto_record=true
2. Mock streamlink → return "live"
3. Trigger check → recording starts
4. Verify database state
5. Stop recording
6. Verify final state (completed, duration set, file size)

#### 4.3 Graceful Shutdown

Simulate:
1. Start multiple recordings
2. Send SIGTERM
3. Verify all recordings marked completed
4. Verify stats updated
5. Verify processes killed

---

### Phase 5: Component Tests (Optional)

#### 5.1 StatsCards

- Loading state renders
- Data fetch and display
- Polling interval (5s)
- Error handling
- Trend indicators

---

## 🎭 Mock Strategy

### External Dependencies to Mock

| Dependency | Mock Strategy |
|------------|---------------|
| `better-sqlite3` | In-memory database per test file |
| `child_process.spawn` | Mock process with EventEmitter |
| `fs` | `vi.mock('fs')` with memfs or mock implementations |
| `fetch` (avatar) | `global.fetch` mock |
| Next.js modules | `vi.mock('next/server')` |

### Example: Streamlink Mock

Simulates streamlink JSON output:

```typescript
const mockStreamlinkLive = {
  metadata: { title: 'Stream Title', category: 'Just Chatting' },
  type: 'hls',
  url: 'https://...'
};

const mockStreamlinkOffline = {
  error: 'No playable streams found'
};
```

---

## 📊 Test Coverage Goals

| Layer | Target Coverage | Priority |
|-------|----------------|----------|
| Models | 95%+ | P0 |
| Services | 85%+ | P0 |
| API Routes | 80%+ | P1 |
| Database | 70% | P2 |
| Components | 60% | P3 |
| **Overall** | **80%+** | - |

---

## 🔧 CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Run Tests
  run: |
    npm ci
    npm run test:unit        # Vitest
    npm run test:integration # Longer tests
  env:
    NODE_ENV: test
    DATA_DIR: ./test-data
```

---

## 🚀 Quick Start Implementation

### Step 1: Install & Configure

```bash
# Install testing dependencies
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom

# Create config files
touch vitest.config.ts
mkdir -p tests/utils
touch tests/setup.ts tests/utils/test-db.ts
```

### Step 2: Write First Model Test

Start with `StreamerModel` as the simplest:
- Create, find, update, delete
- Test username normalization (lowercase)
- Test soft delete behavior

### Step 3: Build Service Mocks

Create the `mock-streamlink.ts` utility before writing service tests.

### Step 4: Iterate

Add tests incrementally with each feature or bug fix.

---

## 🐛 Critical Bugs to Catch with Tests

Based on code review, these scenarios need testing:

1. **Race Condition**: `checkAndRecordStreamers()` has `checkInProgress` flag - test concurrent calls
2. **Orphaned Recordings**: On crash, recordings stay in 'recording' state - test cleanup
3. **Double Recording Prevention**: Both in-memory Map and DB check - test both paths
4. **Process Leaks**: If `stopRecording()` fails, process may linger - test force kill
5. **Stats Inconsistency**: In-memory vs DB count mismatch - test sync

---

## 📅 Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Setup + Models | 4-6 hours | Vitest config, test DB, 4 model test files |
| Phase 2: Service Tests | 1-2 days | Streamlink mocks, recording-service tests |
| Phase 3: API Tests | 1 day | All route handlers tested |
| Phase 4: Integration | 4-6 hours | E2E workflows, shutdown tests |
| Phase 5: Components (optional) | 4-6 hours | React component tests |
| **Total** | **2-3 days** | Comprehensive test suite |

---

## ✅ Success Criteria

- [ ] All model methods have unit tests
- [ ] Recording service has 85%+ coverage
- [ ] All API routes return correct status codes
- [ ] Graceful shutdown is tested
- [ ] CI/CD runs tests on every PR
- [ ] No external network calls in tests (fully mocked)

---

*Last Updated: 2026-01-29*
