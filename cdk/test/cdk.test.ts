import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../lib/backend-stack';

test('all HTTP API routes require the Google Workspace authorizer', () => {
	const app = new cdk.App();
	const stack = new BackendStack(app, 'BackendStack', {
		googleClientId: 'test-web-client-id',
		allowedDomain: 'example.org',
	});
	const template = Template.fromStack(stack);
	const functions = Object.values(template.findResources('AWS::Lambda::Function'));
	expect(functions.length).toBeGreaterThan(0);
	for (const lambdaFunction of functions) {
		expect(lambdaFunction.Properties.Architectures).toEqual(['arm64']);
	}
	const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));

	expect(routes.length).toBeGreaterThan(0);
	for (const route of routes) {
		expect(route.Properties.AuthorizationType).toBe('CUSTOM');
		expect(route.Properties.AuthorizerId).toBeDefined();
	}
	template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
		AuthorizerType: 'REQUEST',
		IdentitySource: ['$request.header.Authorization'],
		AuthorizerPayloadFormatVersion: '1.0',
		AuthorizerResultTtlInSeconds: 0,
	});
	template.hasResourceProperties('AWS::Lambda::Function', {
		Environment: {
			Variables: {
				GOOGLE_CLIENT_ID: 'test-web-client-id',
				ALLOWED_DOMAIN: 'example.org',
			},
		},
	});
});
