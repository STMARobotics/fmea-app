export interface AppConfig {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
}

export const prodConfig: AppConfig = {
  domainName: '7028robotics.com',
  subdomain: 'fmea.7028robotics.com',
  hostedZoneId: 'Z014656337LGZWAE9JKJP',
};