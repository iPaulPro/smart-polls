import { ActOnOpenActionRequest, encodeData, ModuleData, OpenActionModuleInput } from "@lens-protocol/client";
import { Data } from "@lens-protocol/shared-kernel";
import { encodeBytes32String, Signer } from "ethers";
import { EAS, NO_EXPIRATION, SchemaEncoder, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";

export const EAS_ADDRESS = "0xaEF4103A04090071165F78D45D83A0C0782c2B2a";
export const EAS_POLL_ACTION_MODULE_ADDRESS = "0xBd43F2Bc51020347619c2cC243E3B21859f4f64c";
export const EAS_POLL_SCHEMA_UID = "0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd";
export const EAS_POLL_SCHEMA =
  "uint256 publicationProfileId,uint256 publicationId,uint256 actorProfileId,address actorProfileOwner,address transactionExecutor,uint8 optionIndex,uint40 timestamp";

export type EasPoll = {
  /**
   * The options of the poll. Minimum 2, maximum 4. Each option max 32 bytes.
   */
  options: string[];

  /**
   * Whether the poll can only be voted on by followers of the publication author.
   */
  followersOnly: boolean;

  /**
   * The end timestamp of the poll (in seconds).
   */
  endTimestamp: number;

  /**
   * Whether the poll requires a signature to vote.
   */
  signatureRequired: boolean;
};

export type EasVote = {
  /**
   * The profile ID of the publication author.
   */
  publicationProfileId: string;

  /**
   * The ID (index) of the publication.
   */
  publicationId: string;

  /**
   * The profile ID of the voter.
   */
  actorProfileId: string;

  /**
   * The address of the voter.
   */
  actorProfileOwner: string;

  /**
   * The address of the transaction executor.
   */
  transactionExecutor: string;

  /**
   * The index of the voted option.
   */
  optionIndex: 0 | 1 | 2 | 3;

  /**
   * The timestamp of the vote (in seconds).
   */
  timestamp: number;
};

/**
 * Creates an OpenActionModuleInput for initializing a poll on the EAS Poll Action Module.
 *
 * @param poll The poll to create.
 */
export const createPollActionModuleInput = (poll: EasPoll): OpenActionModuleInput => {
  if (poll.options.length < 2 || poll.options.length > 4) {
    throw new Error("There must be between 2 and 4 poll options");
  }

  if (poll.endTimestamp < Math.floor(Date.now() / 1000)) {
    throw new Error("Poll end timestamp must be in the future");
  }

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
      [poll.options.map(encodeBytes32String), poll.followersOnly, poll.endTimestamp.toString(), poll.signatureRequired],
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
 * @param pubId The publication ID of the poll.
 * @param signer The signer to use for creating a signed vote attestation. If not provided, an unsigned vote attestation will be created.
 */
export const createVoteActionRequest = async (
  vote: EasVote,
  pubId: string,
  signer?: Signer,
): Promise<ActOnOpenActionRequest> => {
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
    for: pubId,
  };
};

const encodeVoteAttestationData = async (vote: EasVote): Promise<Data> =>
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

const encodeSignedVoteAttestationData = async (signer: Signer, vote: EasVote): Promise<Data> => {
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
