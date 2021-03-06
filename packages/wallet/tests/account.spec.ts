import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { ethers } from 'ethers'
import hardhat from 'hardhat'
import { WalletContext, NetworkConfig } from '@0xsequence/network'
import { LocalRelayer } from '@0xsequence/relayer'
import { deployWalletContext } from './utils/deploy-wallet-context'
import { isValidConfigSigners, imageHash } from '@0xsequence/config'

import * as lib from '../src'

const { expect } = chai.use(chaiAsPromised)

describe('Account integration', () => {

  let context: WalletContext
  let account: lib.Account
  let owner: ethers.Wallet

  const provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)

  const networks: NetworkConfig[] = [{
    chainId: 31337, name: 'hardhat',
    rpcUrl: '',
    // rpcUrl: `http://localhost:8545/`,
    provider: provider,
    relayer: new LocalRelayer(provider.getSigner()),
    isDefaultChain: true,
    isAuthChain: true
  }]

  before(async () => {
    // Deploy Sequence context
    const [
      factory,
      mainModule,
      mainModuleUpgradable,
      guestModule,
      sequenceUtils
    ] = await deployWalletContext(provider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address,
      guestModule: guestModule.address,
      sequenceUtils: sequenceUtils.address
    }
  })

  beforeEach(async () => {
    // Create account
    owner = new ethers.Wallet(ethers.utils.randomBytes(32))
    const wallet = await lib.Wallet.singleOwner(owner, context)
    
    account = new lib.Account({
      initialConfig: wallet.config,
      networks,
      context
    }, owner)
  })

  describe('config', () => {

    it('should create new instance', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = (await lib.Wallet.singleOwner(owner)).connect(networks[0].provider)

      expect(await wallet.getChainId()).to.equal(31337)
      expect((await wallet.getWalletConfig())[0].signers[0].address).to.equal(await owner.getAddress())

      const account = (new lib.Account({
        initialConfig: (await wallet.getWalletConfig())[0],
        networks
      })).useSigners(owner)

      expect(await account.getChainId()).to.equal(31337)
      expect((await account.getWalletConfig())[0].signers[0].address).to.equal(await owner.getAddress())

      expect(await wallet.getAddress()).to.equal(await account.getAddress())
      expect(await wallet.getSigners()).to.deep.equal(await account.getSigners())
    })

    it('should update config and get current config from chain', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false

      // deploy the wallet
      await account.updateConfig()
      expect(await account.isDeployed()).to.be.true

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account.currentConfig()
      expect(currentConfig.address).to.equal(await account.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await owner.getAddress())
      expect(currentConfig.chainId).to.equal(await account.getChainId())

      // wallet state
      const state = (await account.getWalletState())[0]
      expect(state.config.address).to.equal(await account.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.equal(state.currentImageHash)
      expect(state.imageHash).to.equal(imageHash(currentConfig))
    })

  })

})
