# fmea-app

## Season API

The backend exposes season operations through API Gateway and focused Lambda handlers:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/seasons` | List seasons; optionally filter with `?program=frc` or `?program=ftc` |
| `POST` | `/api/seasons` | Create a season with a JSON body containing `program` (`frc` or `ftc`) and non-empty `name` |
| `GET` | `/api/seasons/{seasonId}` | Get one season |
| `PATCH` | `/api/seasons/{seasonId}` | Update `program`, `name`, or both |
| `DELETE` | `/api/seasons/{seasonId}` | Delete the season and all items in its partition |

Season metadata uses `pk = SEASON#{seasonId}` and `sk = METADATA`. The `GSI1`
index (`gsi1pk = SEASONS`, `gsi1sk = {seasonId}`) supports listing seasons.
Store season-owned records in the same `SEASON#{seasonId}` partition so deleting
a season removes its related records as well.

## Team API

The backend exposes team operations through API Gateway and focused Lambda handlers:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/teams` | List teams; optionally filter with `?program=frc` or `?program=ftc` |
| `POST` | `/api/teams` | Create a team with `program`, positive integer `teamNumber`, and non-empty `name` |
| `GET` | `/api/teams/{teamId}` | Get one team |
| `PATCH` | `/api/teams/{teamId}` | Update `program`, `teamNumber`, `name`, or any combination |
| `DELETE` | `/api/teams/{teamId}` | Delete one team |

Team metadata uses `pk = TEAM#{teamId}` and `sk = METADATA`, with `program`
(`frc` or `ftc`), numeric `teamNumber`, and `name` attributes. The `GSI1`
index (`gsi1pk = TEAMS`, `gsi1sk = {teamId}`) supports listing teams.

## Subsystem API

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/subsystems/{teamId}` | List a team's subsystems |
| `POST` | `/api/subsystems/{teamId}` | Create a subsystem with a JSON body containing `seasonId` and non-empty `name` |

Subsystem metadata uses `pk = TEAM#{teamId}` and
`sk = SUBSYSTEM#{subsystemId}`, with `seasonId` and `name` attributes.

## FMEA API

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/fmea/{teamId}/{seasonId}` | List entries for a team and season |
| `POST` | `/api/fmea/new` | Create an entry using `teamId`, `seasonId`, `subsystemId`, failure details, and ratings |
| `GET` | `/api/fmea/{fmeaId}` | Get one entry |
| `PATCH` | `/api/fmea/{fmeaId}` | Update failure details and ratings |
| `DELETE` | `/api/fmea/{fmeaId}` | Delete one entry |
| `PATCH` | `/api/action-item/{actionItemId}` | Update an action item's status |

FMEA entries use `pk = SUBSYSTEM#{subsystemId}` and
`sk = FMEA#{fmeaId}`. Their `lastUpdated` values are ISO 8601 strings, and
`actionItems` are stored as the specified list of description, status, and
`lastUpdated` values. The API lists entries by querying the team's subsystem
records and then each subsystem's FMEA partition, filtering by season.
`GSI2` (`gsi2pk = FMEA#{fmeaId}`, `gsi2sk = METADATA`) supports lookup by entry
ID. The API derives action item IDs as `{fmeaId}:{index}` for the existing
status-update UI; action items are not added or removed by that workflow.
