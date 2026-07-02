import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
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

    test("Github OIDC provider created", () => {
        template.hasResource("AWS::IAM::OIDCProvider", {
            Properties: {
                ClientIdList: ["sts.amazonaws.com"],
                Url: "https://token.actions.githubusercontent.com"
            }
        });
    });

    test("Github Policy created", () => {
        template.hasResource("AWS::IAM::ManagedPolicy", {
            Properties: {
                ManagedPolicyName: "github-action-policies",
            }
        });
    })
});