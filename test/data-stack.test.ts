import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';

const app = new cdk.App();
const stack = new DataStack(app, 'DataTestStack', { prefix: 'data-test' });
const template = Template.fromStack(stack);

describe('Data stack test', () => {
    test('profile table keyed by sub, on-demand billing, destroyable', () => {
        template.hasResource('AWS::DynamoDB::Table', {
            UpdateReplacePolicy: 'Delete',
            DeletionPolicy: 'Delete',
            Properties: {
                BillingMode: 'PAY_PER_REQUEST',
                KeySchema: [
                    {
                        AttributeName: 'sub',
                        KeyType: 'HASH',
                    },
                ],
            },
        });
    });

    test('table name is CFN-generated so it never collides with the legacy backend-stack table', () => {
        const tables = template.findResources('AWS::DynamoDB::Table');
        for (const table of Object.values(tables)) {
            expect(table.Properties.TableName).toBeUndefined();
        }
    });
});
