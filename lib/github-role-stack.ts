import { aws_iam } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class GithubRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // statements for reading/writing images
        const ecrStatement = new aws_iam.PolicyStatement({
            sid: 'ecrRepoAccess',
            actions: [
                "ecr:DescribeImageScanFindings",
                "ecr:GetLifecyclePolicyPreview",
                "ecr:GetDownloadUrlForLayer",
                "ecr:DescribeImageReplicationStatus",
                "ecr:DescribeImageSigningStatus",
                "ecr:ListTagsForResource",
                "ecr:UploadLayerPart",
                "ecr:BatchGetRepositoryScanningConfiguration",
                "ecr:BatchImportUpstreamImage",
                "ecr:BatchGetImage",
                "ecr:CompleteLayerUpload",
                "ecr:TagResource",
                "ecr:DescribeRepositories",
                "ecr:GetImageCopyStatus",
                "ecr:InitiateLayerUpload",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetRepositoryPolicy",
                "ecr:GetLifecyclePolicy",
                "ecr:PutImage",
                "ecr:ValidatePullThroughCacheRule",
                "ecr:GetRegistryPolicy",
                "ecr:GetAccountSetting",
                "ecr:DescribeRegistry",
                "ecr:DescribeRepositoryCreationTemplates",
                "ecr:GetSigningConfiguration",
                "ecr:GetRegistryScanningConfiguration"
            ],
            resources: [`arn:aws:ecr:*:${process.env.CDK_DEFAULT_ACCOUNT}:repository/*`]
        });

        // statement to login into ecr from github actions
        const wildStatement = new aws_iam.PolicyStatement({
            sid: 'ecrGlobalAccess',
            actions: [
                "ecr:GetAuthorizationToken",
            ],
            resources: ["*"]
        });

        // create managed policy
        const managedPolicy = new aws_iam.ManagedPolicy(this, "GithubActionPolicy", {
            managedPolicyName: "github-action-policies",
            description: "Access needed by Github Actions to run CI/CD operations",
            statements: [ecrStatement, wildStatement]
        });

        // create Identity provider first
        const idProvider = new aws_iam.OidcProviderNative(this, "GithubProvider", {
            url: "https://token.actions.githubusercontent.com",
            clientIds: ["sts.amazonaws.com"]
        });


        // create new Role entrusted to idProvider with managed policies in place
        new aws_iam.Role(this, "GithubRole", {
            roleName: "github-action-role",
            managedPolicies: [managedPolicy],
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
