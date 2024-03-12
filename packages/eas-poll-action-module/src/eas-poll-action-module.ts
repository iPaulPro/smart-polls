import {
  ActOnOpenActionRequest,
  decodeData,
  encodeData,
  ModuleData,
  OpenActionModuleInput,
} from "@lens-protocol/client";
import { Data } from "@lens-protocol/shared-kernel";
import { encodeBytes32String, Signer } from "ethers";
import { EAS, NO_EXPIRATION, SchemaEncoder, ZERO_ADDRESS, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";

import {
  EasPoll,
  EasVote,
  GetVoteCountVariables,
  GetVoteCountForOptionIndexVariables,
  GetVoteForActorVariables,
  PollOption,
  SignedEasVote,
  isSignedVote,
  AttestationData,
  VoteAttestation,
} from "./lib/types";
import {
  EAS_ADDRESS,
  EAS_ADDRESS_TESTNET,
  EAS_GRAPHQL_ENDPOINT,
  EAS_GRAPHQL_ENDPOINT_TESTNET,
  EAS_POLL_ACTION_MODULE_ADDRESS,
  EAS_VOTE_ABI,
  EAS_VOTE_SCHEMA,
  EAS_VOTE_SCHEMA_UID,
  EAS_VOTE_SCHEMA_UID_TESTNET,
  GET_VOTE_COUNT_FOR_OPTION_QUERY,
  GET_VOTE_COUNT_QUERY,
  GET_VOTE_FOR_ACTOR_QUERY,
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

  while (poll.options.length < 4) {
    poll.options.push("");
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
          {
            type: "tuple",
            name: "gateParams",
            components: [
              { type: "address", name: "tokenAddress" },
              { type: "uint256", name: "minThreshold" },
            ],
          },
        ],
      },
    ],
    [
      [
        poll.options.map(encodeBytes32String),
        poll.followersOnly ?? false,
        poll.endTimestamp ?? 0,
        poll.signatureRequired ?? false,
        poll.gateParams ? [poll.gateParams.tokenAddress, poll.gateParams.minThreshold] : [ZERO_ADDRESS, 0],
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
 * @param signer Optional Signer to use for creating a signed vote attestation. If not provided, an unsigned vote attestation will be created.
 */
export const createVoteActionRequest = async (vote: EasVote, signer?: Signer): Promise<ActOnOpenActionRequest> => {
  let data: Data;
  if (signer && isSignedVote(vote)) {
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

/**
 * Creates graphql query variables for getting the vote count of a poll on the EAS Poll Action Module.
 *
 * @param publicationId The full ID of the publication as a hex string (e.g. 0xd8-0x01).
 * @param testnet Whether to use the testnet schema.
 */
export const createVoteCountQueryVariables = (
  publicationId: string,
  testnet: boolean = false,
): GetVoteCountVariables => {
  const pollId = buildPollId(publicationId);
  return {
    schemaId: testnet ? EAS_VOTE_SCHEMA_UID_TESTNET : EAS_VOTE_SCHEMA_UID,
    pollId,
  } satisfies GetVoteCountVariables;
};

/**
 * Creates graphql query variables for getting the vote count of a specific poll option on the EAS Poll Action Module.
 *
 * @param publicationId The full ID of the publication as a hex string (e.g. 0xd8-0x01).
 * @param optionIndex The index of the option to get the vote count for.
 * @param testnet Whether to use the testnet schema.
 */
export const createVoteCountForOptionQueryVariables = (
  publicationId: string,
  optionIndex: PollOption,
  testnet: boolean = false,
): GetVoteCountForOptionIndexVariables => {
  const pollId = buildPollId(publicationId);
  const optionIndexAbi = `{"name":"optionIndex","type":"uint8","value":${optionIndex}}`;
  return {
    schemaId: testnet ? EAS_VOTE_SCHEMA_UID_TESTNET : EAS_VOTE_SCHEMA_UID,
    pollId,
    optionIndex: optionIndexAbi,
  } satisfies GetVoteCountForOptionIndexVariables;
};

export const createVoteForActorQueryVariables = (
  publicationId: string,
  actorProfileId: string,
  testnet: boolean = false,
): GetVoteForActorVariables => {
  const profileId = parseInt(publicationId.split("-")[0]).toString();
  const pubId = parseInt(publicationId.split("-")[1]).toString();
  const data = encodeData(
    [
      { name: "publicationProfileId", type: "uint256" },
      { name: "publicationId", type: "uint256" },
      { name: "actorProfileId", type: "uint256" },
    ],
    [profileId, pubId, actorProfileId],
  );
  return {
    schemaId: testnet ? EAS_VOTE_SCHEMA_UID_TESTNET : EAS_VOTE_SCHEMA_UID,
    data,
  } satisfies GetVoteForActorVariables;
};

/**
 * Gets the vote count of a poll on the EAS Poll Action Module.
 *
 * @param variables The graphql query variables.
 * @param testnet Whether to use the testnet schema.
 *
 * @see createVoteCountQueryVariables
 */
export const getVoteCount = async (variables: GetVoteCountVariables, testnet: boolean = false): Promise<number> => {
  const response = await fetch(testnet ? EAS_GRAPHQL_ENDPOINT_TESTNET : EAS_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_VOTE_COUNT_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.statusText}`);
  }

  const { data } = await response.json();
  return data.groupByAttestation[0]._count._all;
};

/**
 * Gets the vote count of a specific poll option on the EAS Poll Action Module.
 *
 * @param variables The graphql query variables.
 * @param testnet Whether to use the testnet schema.
 *
 * @see createVoteCountForOptionQueryVariables
 */
export const getVoteCountForOption = async (
  variables: GetVoteCountForOptionIndexVariables,
  testnet: boolean = false,
): Promise<number> => {
  const response = await fetch(testnet ? EAS_GRAPHQL_ENDPOINT_TESTNET : EAS_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_VOTE_COUNT_FOR_OPTION_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.statusText}`);
  }

  const { data } = await response.json();
  return data.groupByAttestation[0]._count._all;
};

interface AttestationsResult {
  data: {
    attestations: Attestation[];
  };
}

interface Attestation {
  attester: string;
  id: string;
  revoked: boolean;
  data: string;
}

export const getVoteForActor = async (
  variables: GetVoteForActorVariables,
  testnet: boolean = false,
): Promise<VoteAttestation | null> => {
  const response = await fetch(testnet ? EAS_GRAPHQL_ENDPOINT_TESTNET : EAS_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_VOTE_FOR_ACTOR_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.statusText}`);
  }

  const { data } = (await response.json()) as AttestationsResult;
  const attestations = data.attestations;
  if (attestations.length === 0) {
    return null;
  }

  const moduleData = decodeData(EAS_VOTE_ABI, attestations[0].data);
  const attestationData = {
    publicationProfileId: moduleData[0] as string,
    publicationId: moduleData[1] as string,
    actorProfileId: moduleData[2] as string,
    actorProfileOwner: moduleData[3] as `0x${string}`,
    transactionExecutor: moduleData[4] as `0x${string}`,
    optionIndex: parseInt(moduleData[5] as string),
    timestamp: parseInt(moduleData[6] as string),
  } satisfies AttestationData;

  return {
    attester: attestations[0].attester,
    id: attestations[0].id,
    revoked: attestations[0].revoked,
    data: attestationData,
  };
};

const buildPollId = (publicationId: string): Data => {
  const profileId = parseInt(publicationId.split("-")[0]).toString();
  const pubId = parseInt(publicationId.split("-")[1]).toString();
  return encodeData(
    [
      { name: "publicationProfileId", type: "uint256" },
      { name: "publicationId", type: "uint256" },
    ],
    [profileId, pubId],
  );
};

const encodeVoteAttestationData = async (vote: EasVote): Promise<Data> => {
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
    ],
    [["0", "0", "0", ZERO_ADDRESS, ZERO_ADDRESS, vote.optionIndex.toString(), "0"]],
  );
};

const encodeSignedVoteAttestationData = async (signer: Signer, vote: SignedEasVote): Promise<Data> => {
  if (!vote.publicationId || !vote.actorProfileId || !vote.actorProfileOwner || !vote.transactionExecutor) {
    throw new Error("Signed votes must have publicationId, actorProfileId, actorProfileOwner, and transactionExecutor");
  }

  const network = await signer.provider?.getNetwork();
  if (!network) {
    throw new Error("Signer is not connected to a network");
  }
  const isMainnet = network.matches(POLYGON_MAINNET_CHAIN_ID);

  const publicationProfileId = parseInt(vote.publicationId.split("-")[0]);
  const publicationId = parseInt(vote.publicationId.split("-")[1]);
  const actorProfileId = parseInt(vote.actorProfileId);
  const transactionExecutor = await signer.getAddress();
  const timestamp = Math.floor(Date.now() / 1000);

  const schemaEncoder = new SchemaEncoder(EAS_VOTE_SCHEMA);
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
      schema: isMainnet ? EAS_VOTE_SCHEMA_UID : EAS_VOTE_SCHEMA_UID_TESTNET,
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
