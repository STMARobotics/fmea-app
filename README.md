# fmea-app

## Season API

CloudFront proxies `/api/*` directly to an IAM-authenticated Lambda Function URL.
Origin Access Control signs CloudFront's requests, so the Function URL is not public.
The Lambda router dispatches requests to focused season handlers; API Gateway is not used.

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
