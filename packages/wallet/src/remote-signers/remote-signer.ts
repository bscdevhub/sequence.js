import { BytesLike, Signer as AbstractSigner } from 'ethers'
import { TransactionRequest, TransactionResponse } from '@ethersproject/providers'

export abstract class RemoteSigner extends AbstractSigner {

  abstract signMessageWithData(message: BytesLike, data?: BytesLike): Promise<string>

  signMessage(message: BytesLike): Promise<string> {
    return this.signMessageWithData(message)
  }

  sendTransaction(_: TransactionRequest): Promise<TransactionResponse> {
    throw new Error("sendTransaction method is not supported in RemoteSigner")
  }

  static signMessageWithData(signer: AbstractSigner, message: BytesLike, data?: BytesLike): Promise<string> {
    if (this.isRemoteSigner(signer)) {
      return (signer as RemoteSigner).signMessageWithData(message, data)
    }
    return signer.signMessage(message)
  }

  static isRemoteSigner(signer: AbstractSigner): boolean {
    return (<RemoteSigner>signer).signMessageWithData !== undefined
  }

}
