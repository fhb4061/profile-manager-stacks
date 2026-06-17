import { aws_iam } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class GithubRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create Identity provider first
        const idProvider = new aws_iam.OidcProviderNative(this, "GithubProvider", {
            url: "https://token.actions.githubusercontent.com",
            clientIds: ["sts.amazonaws.com"]
        });

        new aws_iam.Role(this, "GithubRole", {
            roleName: "github-action-role",
            assumedBy: new aws_iam.WebIdentityPrincipal(
                idProvider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                    },
                    StringLike: {
                        "token.actions.githubusercontent.com:sub": [
                            "repo:fhb4061/*",
                            "repo:fhb4061/*"
                        ]
                    }
                }
            )
        });
    }
}
