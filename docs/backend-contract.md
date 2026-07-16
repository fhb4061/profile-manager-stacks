# Backend contract (Java repo + frontend repo)

Constraints this CDK app assumes but cannot enforce. Violating any of these breaks the deployed system silently.

## Java repo: two handlers, one image

| Function | Handler selection | CloudFormation output |
|---|---|---|
| API monolith | image default `CMD` | `BackendStack.ApiFunctionName` |
| Post-confirmation trigger | `CMD` override (see `postConfirmationCmd` in `bin/profile-cdk.ts` — update the placeholder once the real class exists) | `CognitoStack.PostConfirmationFunctionName` |

## Post-confirmation handler rules

1. **Guard the trigger source.** Cognito fires this trigger on password reset too
   (`triggerSource == 'PostConfirmation_ConfirmForgotPassword'`), not just sign-up.
   A blind `PutItem` wipes the user's edited profile on every password reset.
   Either handle only `PostConfirmation_ConfirmSignUp`, or write with
   `ConditionExpression: attribute_not_exists(#sub)` (treat the conditional-check
   failure as success — the trigger retries).
2. **Stay fast.** Cognito waits synchronously, 5s timeout, 2 retries. No Spring,
   no heavy DI — plain handler. Memory is set to 1769MB (1 vCPU) for cold starts.
3. **Idempotent.** Retries mean double invocation is normal.
4. IAM allows `dynamodb:PutItem` only, on the profile table only.

## API handler rules

1. **Caller identity = `sub` from the verified JWT claims**
   (`event.requestContext.authorizer.claims.sub`) — never from the body or path.
   `GET/PUT /profile` operates on that key only.
2. **Public fields only** on `GET /profiles` and `GET /profiles/{sub}` — project
   name/display fields, never email or other PII. Add a test for this in the Java repo.
3. Routes handled internally: `GET /profile`, `PUT /profile`, `GET /profiles`
   (paginated Scan), `GET /profiles/{sub}`. No create (trigger's job), no delete.
4. IAM allows `GetItem`, `PutItem`, `UpdateItem`, `Scan` only.
5. Table name arrives via the `PROFILE_TABLE` env var (CFN-generated name — never hardcode).

## CI in the Java repo must update BOTH functions

`DockerImageCode.fromEcr` pins the image digest at CDK-deploy time. Pushing a new
image to ECR does nothing on its own. After each push, CI must run
`aws lambda update-function-code --function-name <name> --image-uri <uri>` for
**both** function names (read them from the stack outputs above). Updating only the
API fn leaves the trigger running stale code.

## Deploy order / migration notes

- **Fresh account:** push an image to the `profile-backend-lambda` ECR repo *before*
  deploying `CognitoStack` or `BackendStack` — lambda creation fails on an empty repo.
  Order: `GithubRoleStack`/`ECRStack` → push image → `DataStack` → `CognitoStack` → `BackendStack`.
- **Migrating an existing deployment:** the old `profile-table` in `BackendStack` is
  deleted (data loss accepted). The new table has a CFN-generated name, so no collision.
- **Existing pool users have no profile row.** The trigger only fires for new
  confirmations. Delete existing test users (or backfill rows manually) or their
  profile page 404s forever.

## Frontend: send the ID token

The API Gateway Cognito authorizer is configured without OAuth scopes, so it
validates **ID tokens**. Send `Authorization: <idToken>` — the access token will 401.

Deliberate choice (2026-07): first-party single client, uniform permissions — OAuth
scopes would add moving parts for nothing. Revisit (resource server + custom scopes +
`authorizationScopes` per method, frontend switches to access token) if third-party
clients, machine-to-machine callers, or per-route permission tiers ever appear.
