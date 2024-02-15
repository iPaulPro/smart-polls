import {
  ActOnOpenActionRequest,
  AnyPublicationFragment,
  encodeData,
  ModuleData,
  OpenActionModuleInput,
} from "@lens-protocol/client";
import { Data } from "@lens-protocol/shared-kernel";
import { encodeBytes32String, Signer } from "ethers";
import { EAS, NO_EXPIRATION, SchemaEncoder, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";

export const EAS_ADDRESS = "0xaEF4103A04090071165F78D45D83A0C0782c2B2a";
export const EAS_POLL_ACTION_MODULE_ADDRESS = "0xBd43F2Bc51020347619c2cC243E3B21859f4f64c";
export const EAS_POLL_SCHEMA_UID = "0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd";
export const EAS_POLL_SCHEMA =
  "uint256 publicationProfileId,uint256 publicationId,uint256 actorProfileId,address actorProfileOwner,address transactionExecutor,uint8 optionIndex,uint40 timestamp";

export type EasPoll = {
  options: string[];
  followersOnly: boolean;
  endTimestamp: number;
  signatureRequired: boolean;
};

export type EasVote = {
  publicationProfileId: string;
  publicationId: string;
  actorProfileId: string;
  actorProfileOwner: string;
  transactionExecutor: string;
  optionIndex: 0 | 1 | 2 | 3;
  timestamp: number;
};

export const createPollActionModuleInput = (poll: EasPoll): OpenActionModuleInput => {
  const data = encodeData(
    [
      {
        type: "tuple",
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
      poll.options.map(encodeBytes32String),
      poll.followersOnly,
      poll.endTimestamp.toString(),
      poll.signatureRequired,
    ] as ModuleData,
  );

  return {
    unknownOpenAction: {
      address: EAS_POLL_ACTION_MODULE_ADDRESS,
      data,
    },
  } satisfies OpenActionModuleInput;
};

export const createVoteAttestationData = async (vote: EasVote): Promise<Data> =>
  encodeData(
    [
      {
        type: "tuple",
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
        vote.publicationProfileId.toString(),
        vote.publicationId.toString(),
        vote.actorProfileId.toString(),
        vote.actorProfileOwner,
        vote.transactionExecutor,
        vote.optionIndex.toString(),
        vote.timestamp.toString(),
      ],
    ],
  );

export const createSignedVoteAttestationData = async (signer: Signer, vote: EasVote): Promise<Data> => {
  const schemaEncoder = new SchemaEncoder(EAS_POLL_SCHEMA);
  const encodedData = schemaEncoder.encodeData([
    { name: "publicationProfileId", value: vote.publicationProfileId, type: "uint256" },
    { name: "publicationId", value: vote.publicationId, type: "uint256" },
    { name: "actorProfileId", value: vote.actorProfileId, type: "uint256" },
    { name: "actorProfileOwner", value: vote.actorProfileOwner, type: "address" },
    { name: "transactionExecutor", value: vote.transactionExecutor, type: "address" },
    { name: "optionIndex", value: vote.optionIndex, type: "uint8" },
    { name: "timestamp", value: vote.timestamp, type: "uint40" },
  ]);

  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);

  const account = await signer.getAddress();
  const nonce = await eas.getNonce(account);

  const delegated = await eas.getDelegated();
  const response = await delegated.signDelegatedAttestation(
    {
      schema: EAS_POLL_SCHEMA_UID,
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
        type: "tuple",
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
        type: "tuple",
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
        vote.publicationProfileId.toString(),
        vote.publicationId.toString(),
        vote.actorProfileId.toString(),
        vote.actorProfileOwner,
        vote.transactionExecutor,
        vote.optionIndex.toString(),
        vote.timestamp.toString(),
      ],
      [signature.v.toString(), signature.r, signature.s],
      NO_EXPIRATION.toString(),
    ],
  );
};

export const createVoteActionRequest = async (
  vote: EasVote,
  publication: AnyPublicationFragment,
  signer?: Signer,
): Promise<ActOnOpenActionRequest> => {
  let data: Data;
  if (signer) {
    data = await createSignedVoteAttestationData(signer, vote);
  } else {
    data = await createVoteAttestationData(vote);
  }

  return {
    actOn: {
      unknownOpenAction: {
        address: EAS_POLL_ACTION_MODULE_ADDRESS,
        data,
      },
    },
    for: publication.id,
  };
};
