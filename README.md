# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm run deploy`  deploy this stack to your default AWS account/region
* `npm run diff`    compare deployed stack with current state
* `npm run synth`   emits the synthesized CloudFormation template

`POST` curl command:

```
curl -X POST https://<API-ID>.execute-api.<REGION>.amazonaws.com/<stage>/profile \
    -H "Authorization: Bearer <COGNITO_JWT>" \
    -H "Content-Type: application/json" \
    -d '{"displayName":"Pat"}'
```

Notes

- `POST /profile` is protected by Cognito User Pool auth.
- The Lambda is deployed from an ECR image and created as a synchronous create API.
- Profile records are keyed by Cognito `sub`.

Browser login (Hosted UI)

- The Cognito User Pool Client is configured for the OAuth authorization-code flow via Cognito's managed Hosted UI (no custom domain needed).
- `CognitoStack` outputs `UserPoolId`, `UserPoolClientId`, and `HostedUIDomain` — read these (e.g. `aws cloudformation describe-stacks --stack-name CognitoStack`) from the frontend repo to build the Hosted UI login URL and validate tokens.
- Callback/logout URLs are currently placeholders (`http://localhost:3000/...`) set in `bin/profile-cdk.ts`; update them once the frontend has a real (HTTPS) URL — Cognito only allows non-HTTPS callbacks for `localhost`.

Architecture

![architecture](/docs/architecture.svg)
