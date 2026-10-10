#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// Environment configuration required for Route 53 lookups
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
};

// 1. Deploy Backend Infrastructure
const backend = new BackendStack(app, 'AppBackendStack', { env });

// 2. Deploy Frontend Infrastructure
new FrontendStack(app, 'AppFrontendStack', {
  env,
  domainName: '7028robotics.com',
  subdomain: 'fmea.7028robotics.com',
  functionUrl: backend.functionUrl,
});