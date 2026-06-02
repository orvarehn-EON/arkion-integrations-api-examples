# integrations-api-examples

Examples of how to use Arkions integrations API.

## Scenario: Get Project (token first)

This example runs a CLI flow with no UI:

1. Exchange an assertion token for an access token:
	 - `POST /tenant/{tenant_id}/auth/token`
2. Use the access token to fetch a project:
	 - `GET /tenant/{tenant_id}/projects/{project_id}`

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Configure .env

Edit `.env` in the repo root and set your values.

Required values in `.env`:

- `INTEGRATIONS_API_KEY`
- `INTEGRATIONS_ORIGIN`
- `TENANT_ID`
- `PUBLIC_KEY`
- `PRIVATE_KEY`

Optional:

- `INTEGRATIONS_BASE_URL` (defaults to `https://integrations-gateway.dev.arkion.co`)

The app generates an assertion JWT from `PUBLIC_KEY` + `PRIVATE_KEY`, then sends it to `POST /tenant/{tenant_id}/auth/token`.

## Run From macOS CLI (direct node)

```bash
node dist/src/run-scenario.js get-project <project_id>
```

Example:

```bash
node dist/src/run-scenario.js get-project 42
```

## Generic npm helper

If you prefer a single command that builds and runs any scenario:

```bash
npm run scenario -- get-project <project_id>
```

When adding new scenarios, create a file in `src/scenarios` and run it by filename.
Example: `src/scenarios/list-projects.ts` can be run as `npm run scenario -- list-projects`.

## Additional Scenario: Get Projects From Token Scopes

This scenario creates an access token and returns all project IDs found in `scopes.project_ids` from the token claims.

```bash
npm run scenario -- get-projects
```

Example output:

```json
{
	"project_ids": [42, 1337]
}
```

## Additional Scenarios: Images

Get images for a project:

```bash
npm run scenario -- get-images <project_id>
```

Get image objects for a project:

```bash
npm run scenario -- get-image-objects <project_id> <image_id>
```

Get image object types for a specific image:

```bash
npm run scenario -- get-image-object-types <project_id> <image_id>
```

## Expected output

The script prints:

- A short status line for token creation
- A short status line for project fetch
- Pretty JSON response of the project

## Equivalent curl calls

Token exchange:

```bash
curl -X POST "https://integrations-gateway.dev.arkion.co/tenant/<tenant_id>/auth/token" \
	-H "x-api-key: $INTEGRATIONS_API_KEY" \
	-H "Origin: $INTEGRATIONS_ORIGIN" \
	-H "Content-Type: application/json" \
	-d '{"token":"<generated_assertion_token>"}'
```

Project call with bearer token:

```bash
curl -X GET "https://integrations-gateway.dev.arkion.co/tenant/<tenant_id>/projects/<project_id>" \
	-H "x-api-key: $INTEGRATIONS_API_KEY" \
	-H "Authorization: Bearer <access_token>"
```

## Notes

- `INTEGRATIONS_ORIGIN` is required by the token exchange endpoint.
- Assertion token is generated at runtime from `.env` keys (`PUBLIC_KEY`, `PRIVATE_KEY`).
- If you receive `token_expired` or `invalid_token`, request a new token and retry.
- If you receive `project_access_denied`, use a tenant token that has access to the project.

## Project API Module

Project-related calls now use the generic HTTP client in `src/api/http-client.ts`, with endpoint requests performed directly in scenarios/tasks.

## Webhook Receiver Example

The repo also includes an example local server that can receive webhook POST calls from the integrations API.

Start the server:

```bash
npm run server
```

Watch mode for local testing (auto-restarts on file changes):

```bash
npm run dev
```

Optional port override:

```bash
WEBHOOK_PORT=9999 npm run server
```

Available webhook endpoints:

- `POST /ping`
- `POST /project-report-available`
- `POST /project-archived`
- `POST /urgent-deficiency`

Background task behavior:

- `POST /urgent-deficiency` emits an in-memory event that triggers the task in `src/tasks/urgent-deficiency.ts`.
- The task runs in the background so the webhook endpoint can return `202` immediately.

Utility endpoints:

- `GET /health`

Example curl calls:

```bash
curl -X POST "http://localhost:8787/ping" \
	-H "Content-Type: application/json" \
	-d '{"event_id":"evt_1","message":"ping"}'

curl -X POST "http://localhost:8787/project-report-available" \
	-H "Content-Type: application/json" \
	-d '{"event_id":"evt_2","project_id":42,"report_id":"rpt_100"}'

curl -X POST "http://localhost:8787/project-archived" \
	-H "Content-Type: application/json" \
	-d '{"event_id":"evt_3","project_id":42,"archived":true}'

curl -X POST "http://localhost:8787/urgent-deficiency" \
	-H "Content-Type: application/json" \
	-d '{"event_id":"evt_4","project_id":42,"severity":"critical"}'
```
