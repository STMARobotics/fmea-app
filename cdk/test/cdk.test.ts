import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../lib/backend-stack';

test('application routes require the session authorizer and auth routes stay public', () => {
	const app = new cdk.App();
	const stack = new BackendStack(app, 'BackendStack', {
		googleClientId: 'test-web-client-id',
		allowedDomain: 'example.org',
		googleClientSecretParameter: '/fmea/test/google-client-secret',
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
		if (String(route.Properties.RouteKey).includes('/api/auth/')) {
			expect(route.Properties.AuthorizationType).toBe('NONE');
		} else {
			expect(route.Properties.AuthorizationType).toBe('CUSTOM');
			expect(route.Properties.AuthorizerId).toBeDefined();
		}
	}
	template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
		AuthorizerType: 'REQUEST',
		IdentitySource: ['$request.header.Cookie'],
		AuthorizerPayloadFormatVersion: '1.0',
		AuthorizerResultTtlInSeconds: 0,
	});
	template.hasResourceProperties('AWS::Lambda::Function', {
		Handler: 'index.handler',
		Environment: {
			Variables: {
				TABLE_NAME: Match.anyValue(),
				GOOGLE_CLIENT_ID: 'test-web-client-id',
				ALLOWED_DOMAIN: 'example.org',
			},
		},
	});
});
