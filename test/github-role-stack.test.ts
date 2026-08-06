import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as GithubRoleStack from '../lib/github-role-stack';

const app = new cdk.App();
const stack = new GithubRoleStack.GithubRoleStack(app, 'MyTestStack');
const template = Template.fromStack(stack);

describe("Github role, policy, and provider test", () => {

    test("Github role created", () => {
        template.hasResource("AWS::IAM::Role", {
            Properties: {
                RoleName: "github-action-role"
            }
        });
    });

    test("role can only be assumed by profile-lambda repo on master branch", () => {
        template.hasResourceProperties("AWS::IAM::Role", {
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Action: "sts:AssumeRoleWithWebIdentity",
                        Condition: {
                            StringEquals: {
                                "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                            },
                            StringLike: {
                                "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-lambda:ref:refs/heads/master"
                            }
                        }
                    }
                ]
            }
        });
    });

    test("Github OIDC provider created", () => {
        template.hasResource("AWS::IAM::OIDCProvider", {
            Properties: {
                ClientIdList: ["sts.amazonaws.com"],
                Url: "https://token.actions.githubusercontent.com"
            }
        });
    });

    test("ECR permissions are inlined on the role, no managed policy", () => {
        template.resourceCountIs("AWS::IAM::ManagedPolicy", 0);
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: [
                    {
                        Sid: "ecrRepoAccess",
                        Action: [
                            "ecr:BatchGetImage",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:DescribeRepositories",
                            "ecr:InitiateLayerUpload",
                            "ecr:UploadLayerPart",
                            "ecr:CompleteLayerUpload",
                            "ecr:PutImage"
                        ],
                        Effect: "Allow"
                    },
                    {
                        Sid: "ecrGlobalAccess",
                        Action: "ecr:GetAuthorizationToken",
                        Effect: "Allow",
                        Resource: "*"
                    }
                ]
            }
        });
    })

    test("ECR repo access is scoped to profile-* repos in the stack's region and account", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Sid: "ecrRepoAccess",
                        Resource: {
                            "Fn::Join": ["", [
                                "arn:aws:ecr:",
                                { Ref: "AWS::Region" },
                                ":",
                                { Ref: "AWS::AccountId" },
                                ":repository/profile-*"
                            ]]
                        }
                    })
                ])
            }
        });
    });

    test("output exposes the role ARN for GitHub Actions workflow config", () => {
        template.hasOutput('RoleArn', {});
    })
});