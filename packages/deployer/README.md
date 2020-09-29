# @arcadeum/deployer

Deploy contracts using a universal deployer via CREATE2, allowing contracts to have the same address on any EVM chain. 

# How to use

1. `yarn install @arcadeum/deployer`
1. Import UniversalDeployer into script
2. Create UniversalDeployer instance
3. Deploy contracts 

An `instance` number can be passed if multiple instance of the same contract need to be deployed on the same chain. The default instance number is 0, if none is passed.

```typescript
...
import { UniversalDeployer } from '@arcadeum/deployer'

const signer = (new Web3Provider(web3.currentProvider)).getSigner()
const universalDeployer = new UniversalDeployer(network.name, signer)

const main = async () => {
  await universalDeployer.deploy('WalletFactory', FactoryFactory)
  await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory)
  await universalDeployer.deploy('GuestModule', GuestModuleFactory)

  prompt.start(`writing deployment information to ${network.name}.json`)
  await universalDeployer.registerDeployment()
  prompt.succeed()
}

main()
```

You can also pass transaction parameters explicitely :

```typescript
...

const main = async () => {
  await universalDeployer.deploy('WalletFactory', FactoryFactory, {gasLimit: 1000000} )
  await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory, {gasPrice: new BigNumber(10).pow(9)})
}

```

---

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Copyright (c) 2018-present Horizon Blockchain Games Inc.