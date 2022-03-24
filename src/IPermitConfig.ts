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
function printConfig() {
  console.log(JSON.stringify(defaultConfig));
}

export { IPermitConfig, provideConfig, printConfig };