# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

`POST` curl command:

```
curl -X POST https://<API-ID>.execute-api.<REGION>.amazonaws.com/<stage>/job \
    -H "X-Amz-Invocation-Type: Event" \
    -H "Content-Type: application/json" \
    -d '{}'
```

Architecture

![architecture](/docs/architecture.svg)
