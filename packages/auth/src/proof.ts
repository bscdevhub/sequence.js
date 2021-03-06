import { Proof, ValidatorFunc, IsValidSignatureBytes32MagicValue } from '@arcadeum/ethauth'
import { ethers } from 'ethers'
import { sequenceContext } from '@0xsequence/network'
import { packMessageData, isValidSequenceUndeployedWalletSignature } from '@0xsequence/wallet'

export const ValidateSequenceDeployedContractAccountProof: ValidatorFunc = async (provider: ethers.providers.JsonRpcProvider, chainId: number, proof: Proof): Promise<{ isValid: boolean, address?: string }> => {

  if (!provider || provider === undefined || chainId === undefined) {
    return { isValid: false }
  }

  // Compute eip712 message digest from the proof claims
  const message = proof.messageDigest()

  // Early check to ensure the contract wallet has been deployed
  const walletCode = await provider.getCode(proof.address)
  if (walletCode === '0x' || walletCode.length <= 2) {
    throw new Error('ValidateSequenceDeployedContractAccountProof failed. unable to fetch wallet contract code')
  }

  // Call EIP-1271 IsValidSignature(bytes32, bytes) method on the deployed wallet. Note: for undeployed
  // wallets, you will need to implement your own ValidatorFunc with the additional context.
  const abi = [ 'function isValidSignature(bytes32, bytes) public view returns (bytes4)' ]
  const contract = new ethers.Contract(proof.address, abi, provider)

  // hash the message digest as required by isValidSignature
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

  // sequence wallet isValidSignature requires a additional encoding
  const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.arrayify(packMessageData(proof.address, chainId, digest))))

  const isValidSignature = await contract.isValidSignature(subDigest, ethers.utils.arrayify(proof.signature))

  if (isValidSignature === IsValidSignatureBytes32MagicValue) {
    return { isValid: true }
  } else {
    return { isValid: false }
  }
}

export const ValidateSequenceUndeployedContractAccountProof: ValidatorFunc = async (provider: ethers.providers.JsonRpcProvider, chainId: number, proof: Proof): Promise<{ isValid: boolean, address?: string }> => {

  if (!provider || provider === undefined || chainId === undefined) {
    return { isValid: false }
  }

  // Compute eip712 message digest from the proof claims
  const message = proof.messageDigest()

  // hash the message digest as required by isValidSignature
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

  const isValid = await isValidSequenceUndeployedWalletSignature(
    proof.address,
    digest,
    proof.signature,
    sequenceContext,
    provider,
    chainId
  )

  return { isValid: isValid }
}
