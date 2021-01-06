/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import { Contract, ContractFactory, Overrides } from "@ethersproject/contracts";

import type { NanoUniversalDeployer } from "../NanoUniversalDeployer";

export class NanoUniversalDeployer__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(overrides?: Overrides): Promise<NanoUniversalDeployer> {
    return super.deploy(overrides || {}) as Promise<NanoUniversalDeployer>;
  }
  getDeployTransaction(overrides?: Overrides): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): NanoUniversalDeployer {
    return super.attach(address) as NanoUniversalDeployer;
  }
  connect(signer: Signer): NanoUniversalDeployer__factory {
    return super.connect(signer) as NanoUniversalDeployer__factory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): NanoUniversalDeployer {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as NanoUniversalDeployer;
  }
}

const _abi = [
  {
    anonymous: true,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_addr",
        type: "address",
      },
    ],
    name: "Deploy",
    type: "event",
  },
  {
    stateMutability: "payable",
    type: "fallback",
  },
];

const _bytecode =
  "0x6080604052348015600f57600080fd5b5060a580601d6000396000f3fe60a06020601f3690810182900490910282016040526080818152600092839283918190838280828437600092018290525084519495509392505060208401905034f56040805173ffffffffffffffffffffffffffffffffffffffff83168152905191935081900360200190a0505000fea26469706673582212207457f4b6f392e3ba295b33e363360d55f06ead85ec96165a406e7b0231ab668464736f6c63430007060033";