import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import * as ECRStack from '../lib/ecr-stack';

const app = new cdk.App();
const stack = new ECRStack.ECRStack(app, 'MyTestStack');
const template = Template.fromStack(stack);

describe('ECR stack test', () => {
    test('frontend and lambda repositories created', () => {
        template.hasResourceProperties('AWS::ECR::Repository', {
            RepositoryName: 'profile-manager-fe'
        });

        template.hasResourceProperties('AWS::ECR::Repository', {
            RepositoryName: 'profile-backend-lambda'
        });
    });
});
