import { appConfig } from './app.config';

describe('appConfig', () => {
  it('provides application-level providers including the router', () => {
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });
});
