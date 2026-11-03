# Database follow-ups

Ideas for after the database freeze. Each one needs its own new migration
and tests; none blocks the launch.

| Idea | Why | Notes |
| --- | --- | --- |
| `profiles.language` | push texts in the user's language (today Spanish only) | push-dispatch would pick es/en templates |
| Retry push on FCM 5xx | delivery is at most once today | needs a `push_attempts` column and backoff |
