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
