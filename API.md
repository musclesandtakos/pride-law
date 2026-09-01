# Pride Law Codex API

A REST API for managing Pride law resources and information.

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### GET /codex
Read all codex entries

**Response:**
```json
[
  {
    "id": "1",
    "title": "Introduction to Pride Laws",
    "content": "Pride laws are legislative measures...",
    "category": "overview",
    "createdAt": "2026-09-01T00:00:00.000Z",
    "updatedAt": "2026-09-01T00:00:00.000Z"
  }
]
```

### GET /codex/:id
Read a specific codex entry

**Parameters:**
- `id` (string) - Entry ID

**Response:**
```json
{
  "id": "1",
  "title": "Introduction to Pride Laws",
  "content": "Pride laws are legislative measures...",
  "category": "overview",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T00:00:00.000Z"
}
```

### POST /codex
Create a new codex entry

**Request Body:**
```json
{
  "title": "Entry Title",
  "content": "Entry content",
  "category": "overview"
}
```

**Response:** (201 Created)
```json
{
  "id": "1234567890",
  "title": "Entry Title",
  "content": "Entry content",
  "category": "overview",
  "createdAt": "2026-09-01T12:34:56.000Z",
  "updatedAt": "2026-09-01T12:34:56.000Z"
}
```

### PUT /codex/:id
Update an existing codex entry

**Parameters:**
- `id` (string) - Entry ID

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "category": "updated-category"
}
```

**Response:**
```json
{
  "id": "1",
  "title": "Updated Title",
  "content": "Updated content",
  "category": "updated-category",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T12:34:56.000Z"
}
```

### DELETE /codex/:id
Delete a codex entry

**Parameters:**
- `id` (string) - Entry ID

**Response:**
```json
{
  "message": "Entry deleted",
  "entry": {
    "id": "1",
    "title": "Deleted Entry",
    ...
  }
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok"
}
```

## Data Storage

The codex entries are stored in `codex.json` file in the root directory. The file is automatically created on first run if it doesn't exist.
