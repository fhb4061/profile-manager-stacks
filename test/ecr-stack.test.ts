import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import * as ECRStack from '../lib/ecr-stack';

const app = new cdk.App();
const stack = new ECRStack.ECRStack(app, 'MyTestStack');
const template = Template.fromStack(stack);

describe('ECR stack test', () => {
    test('lambda repository created', () => {
        template.resourceCountIs('AWS::ECR::Repository', 1);
        template.hasResourceProperties('AWS::ECR::Repository', {
            RepositoryName: 'profile-backend-lambda'
        });
    });

    test('output exposes the repository URI as the docker push target', () => {
        template.hasOutput('LambdaRepositoryUri', {});
    });
});
