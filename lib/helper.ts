import * as fs from 'fs';

interface EnvironmentConfig {
  bucketName: string;
  requestLogging: boolean;
}

export function loadConfig(environment: string): EnvironmentConfig {
  const settings = JSON.parse(fs.readFileSync('settings.json', 'utf-8'));
  if (!settings[environment]) {
    throw new Error(`Configuration for environment '${environment}' not found.`);
  }
  return settings[environment];
}
