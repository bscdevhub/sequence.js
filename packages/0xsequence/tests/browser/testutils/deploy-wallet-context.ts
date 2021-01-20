import { ethers } from 'ethers'
import { Provider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { UniversalDeployer } from '@0xsequence/deployer'
import { WalletContext } from '@0xsequence/network'
import { testAccounts, getEOAWallet } from './accounts'

import {
  Factory__factory as FactoryFactory,
  MainModule__factory as MainModuleFactory,
  MainModuleUpgradable__factory as MainModuleUpgradableFactory,
  GuestModule__factory as GuestModuleFactory,
  SequenceUtils__factory as SequenceUtilsFactory,
} from '@0xsequence/wallet-contracts/typings/contracts'

const deployWalletContextCache: WalletContext[] = []

// deployWalletContext will deploy the Sequence WalletContext via the UniversalDeployer
// which will return deterministic contract addresses between calls.
export const deployWalletContext = async (...providers: JsonRpcProvider[]): Promise<WalletContext> => {
  if (!providers || providers.length === 0) {
    providers.push(new JsonRpcProvider('http://localhost:8545'))
  }
  
  // Memoize the result. Even though its universal/deterministic, caching the result
  // offers greater efficiency between calls
  if (deployWalletContextCache.length === providers.length) {
    return deployWalletContextCache[0]
  }

  await Promise.all(providers.map(async provider => {
    // Deploying test accounts with the first test account
    const wallet = getEOAWallet(testAccounts[0].privateKey, provider)

    // Universal deployer for deterministic contract addresses
    const universalDeployer = new UniversalDeployer('local', wallet.provider as JsonRpcProvider)
    const txParams = { gasLimit: 8000000, gasPrice: ethers.BigNumber.from(10).pow(9).mul(10) }

    const walletFactory = await universalDeployer.deploy('WalletFactory', FactoryFactory, txParams)
    const mainModule = await universalDeployer.deploy('MainModule', MainModuleFactory, txParams, 0, walletFactory.address)

    await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory, txParams)
    await universalDeployer.deploy('GuestModule', GuestModuleFactory, txParams)
    await universalDeployer.deploy('SequenceUtils', SequenceUtilsFactory, txParams, 0, walletFactory.address, mainModule.address)

    const deployment = universalDeployer.getDeployment()

    deployWalletContextCache.push({
      factory: deployment['WalletFactory'].address,
      mainModule: deployment['MainModule'].address,
      mainModuleUpgradable: deployment['MainModuleUpgradable'].address,
      guestModule: deployment['GuestModule'].address,
      sequenceUtils: deployment['SequenceUtils'].address
    })
  }))

  return deployWalletContextCache[0]
}


// testWalletContext is determined by the `deployWalletContext` method above. We can use this
// across instances, but, we must ensure the contracts are deployed by the mock-wallet at least.
export const testWalletContext: WalletContext = {
  factory: "0x34612d35C278c69589111C58FB9405e034070F8D",
  guestModule: "0x1a4FEB2Efc0FC59423548846E8d292b3841921EE",
  mainModule: "0x8D67A92cBa68A657aa1f62e0ec0BE8103724A1bc",
  mainModuleUpgradable: "0xca89BeDA890eEED45e2756B53F7BaBec05A7760A",
  sequenceUtils: "0xE6b398A203B82987190D587204a267712143B46d"
}
