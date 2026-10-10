#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { prodConfig } from '../lib/config';

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;

// 1. Certificate stack MUST be in us-east-1 for CloudFront
const certStack = new CertificateStack(app, 'AppCertificateStack', {
  env: { account, region: 'us-east-1' },
  domainName: prodConfig.domainName,
  subdomain: prodConfig.subdomain,
  hostedZoneId: prodConfig.hostedZoneId,
});

// 2. Backend stack in us-east-2
const backendStack = new BackendStack(app, 'AppBackendStack', {
  env: { account, region: 'us-east-2' },
});

// 3. Frontend stack in us-east-2, passing the us-east-1 certificate and backend function URL
new FrontendStack(app, 'AppFrontendStack', {
  env: { account, region: 'us-east-2' },
  domainName: prodConfig.domainName,
  subdomain: prodConfig.subdomain,
  hostedZoneId: prodConfig.hostedZoneId,
  functionUrl: backendStack.functionUrl,
  certificate: certStack.certificate,
});