class IPermitConfig {
  dataProvider?: {
    type: 'mongodb',
    connectionString?: `${'mongodb' | 'mongodb+srv'}://${string}`
  } | { type: 'custom' }
    = { type: 'mongodb' };

}

let defaultConfig: IPermitConfig;
function provideConfig(config: IPermitConfig) {
  defaultConfig = config;
}

export { IPermitConfig, provideConfig };