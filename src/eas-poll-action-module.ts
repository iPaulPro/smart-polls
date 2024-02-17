import { ActOnOpenActionRequest, encodeData, ModuleData, OpenActionModuleInput } from "@lens-protocol/client";
import { Data } from "@lens-protocol/shared-kernel";
import { encodeBytes32String, Signer } from "ethers";
import { EAS, NO_EXPIRATION, SchemaEncoder, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";

import { EasPoll, EasVote } from "./lib/types";
import {
  EAS_ADDRESS,
  EAS_ADDRESS_TESTNET,
  EAS_POLL_ACTION_MODULE_ADDRESS,
  EAS_POLL_SCHEMA,
  EAS_POLL_SCHEMA_UID,
  EAS_POLL_SCHEMA_UID_TESTNET,
} from "./lib/constants";

const POLYGON_MAINNET_CHAIN_ID = 137;

/**
 * Creates an OpenActionModuleInput for initializing a poll on the EAS Poll Action Module.
 *
 * @param poll The poll to create.
 */
export const createPollActionModuleInput = (poll: EasPoll): OpenActionModuleInput => {
  if (poll.options.length < 2 || poll.options.length > 4) {
    throw new Error("There must be between 2 and 4 poll options");
  }

  if (poll.endTimestamp && poll.endTimestamp < Math.floor(Date.now() / 1000)) {
    throw new Error("Poll end timestamp must be in the future");
  }

  const data = encodeData(
    [
      {
        type: "tuple(bytes32[4],bool,uint40,bool)",
        name: "poll",
        components: [
          { type: "bytes32[4]", name: "options" },
          { type: "bool", name: "followersOnly" },
          { type: "uint40", name: "endTimestamp" },
          { type: "bool", name: "signatureRequired" },
        ],
      },
    ],
    [
      [
        poll.options.map(encodeBytes32String),
        poll.followersOnly ?? false,
        poll.endTimestamp?.toString() ?? 0,
        poll.signatureRequired ?? false,
      ],
    ] as ModuleData,
  );

  return {
    unknownOpenAction: {
      address: EAS_POLL_ACTION_MODULE_ADDRESS,
      data,
    },
  } satisfies OpenActionModuleInput;
};

/**
 * Creates an ActOnOpenActionRequest for voting on a poll on the EAS Poll Action Module.
 *
 * @param vote The vote to create.
 * @param signer Optional signer to use for creating a signed vote attestation. If not provided, an unsigned vote attestation will be created.
 */
export const createVoteActionRequest = async (vote: EasVote, signer?: Signer): Promise<ActOnOpenActionRequest> => {
  let data: Data;
  if (signer) {
    data = await encodeSignedVoteAttestationData(signer, vote);
  } else {
    data = await encodeVoteAttestationData(vote);
  }

  return {
    actOn: {
      unknownOpenAction: {
        address: EAS_POLL_ACTION_MODULE_ADDRESS,
        data,
      },
    },
    for: vote.publicationId,
  };
};

const encodeVoteAttestationData = async (vote: EasVote): Promise<Data> =>
  encodeData(
    [
      {
        type: "tuple(uint256,uint256,uint256,address,uint8,uint40)",
        components: [
          { type: "uint256", name: "publicationProfileId" },
          { type: "uint256", name: "publicationId" },
          { type: "uint256", name: "actorProfileId" },
          { type: "address", name: "actorProfileOwner" },
          { type: "address", name: "transactionExecutor" },
          { type: "uint8", name: "optionIndex" },
          { type: "uint40", name: "timestamp" },
        ],
        name: "vote",
      },
    ],
    [
      [
        parseInt(vote.publicationId.split("-")[0]).toString(),
        parseInt(vote.publicationId.split("-")[1]).toString(),
        vote.actorProfileId.toString(),
        vote.actorProfileOwner,
        vote.transactionExecutor ?? vote.actorProfileOwner,
        vote.optionIndex.toString(),
        vote.timestamp?.toString() ?? Math.floor(Date.now() / 1000).toString(),
      ],
    ],
  );

const encodeSignedVoteAttestationData = async (signer: Signer, vote: EasVote): Promise<Data> => {
  const network = await signer.provider?.getNetwork();
  if (!network) {
    throw new Error("Signer is not connected to a network");
  }
  const isMainnet = network.matches(POLYGON_MAINNET_CHAIN_ID);

  const publicationProfileId = parseInt(vote.publicationId.split("-")[0], 16);
  const publicationId = parseInt(vote.publicationId.split("-")[1], 16);
  const actorProfileId = parseInt(vote.actorProfileId, 16);
  const transactionExecutor = vote.transactionExecutor ?? vote.actorProfileOwner;
  const timestamp = vote.timestamp ?? Math.floor(Date.now() / 1000);

  const schemaEncoder = new SchemaEncoder(EAS_POLL_SCHEMA);
  const encodedData = schemaEncoder.encodeData([
    { name: "publicationProfileId", value: publicationProfileId, type: "uint256" },
    { name: "publicationId", value: publicationId, type: "uint256" },
    { name: "actorProfileId", value: actorProfileId, type: "uint256" },
    { name: "actorProfileOwner", value: vote.actorProfileOwner, type: "address" },
    { name: "transactionExecutor", value: transactionExecutor, type: "address" },
    { name: "optionIndex", value: vote.optionIndex, type: "uint8" },
    { name: "timestamp", value: timestamp, type: "uint40" },
  ]);

  const eas = new EAS(isMainnet ? EAS_ADDRESS : EAS_ADDRESS_TESTNET);
  eas.connect(signer);

  const account = await signer.getAddress();
  const nonce = await eas.getNonce(account);

  const delegated = await eas.getDelegated();
  const response = await delegated.signDelegatedAttestation(
    {
      schema: isMainnet ? EAS_POLL_SCHEMA_UID : EAS_POLL_SCHEMA_UID_TESTNET,
      data: encodedData,
      nonce: nonce,
      revocable: true,
      recipient: EAS_POLL_ACTION_MODULE_ADDRESS,
      expirationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      value: 0n,
      deadline: NO_EXPIRATION,
    },
    signer,
  );

  const signature = response.signature;

  return encodeData(
    [
      {
        type: "tuple(uint256,uint256,uint256,address,uint8,uint40)",
        components: [
          { type: "uint256", name: "publicationProfileId" },
          { type: "uint256", name: "publicationId" },
          { type: "uint256", name: "actorProfileId" },
          { type: "address", name: "actorProfileOwner" },
          { type: "address", name: "transactionExecutor" },
          { type: "uint8", name: "optionIndex" },
          { type: "uint40", name: "timestamp" },
        ],
        name: "vote",
      },
      {
        type: "tuple(uint8,bytes32,bytes32)",
        components: [
          { type: "uint8", name: "v" },
          { type: "bytes32", name: "r" },
          { type: "bytes32", name: "s" },
        ],
        name: "signature",
      },
      { type: "uint64", name: "deadline" },
    ],
    [
      [
        publicationProfileId.toString(),
        publicationId.toString(),
        actorProfileId.toString(),
        vote.actorProfileOwner,
        transactionExecutor,
        vote.optionIndex.toString(),
        timestamp.toString(),
      ],
      [signature.v.toString(), signature.r, signature.s],
      NO_EXPIRATION.toString(),
    ],
  );
};
