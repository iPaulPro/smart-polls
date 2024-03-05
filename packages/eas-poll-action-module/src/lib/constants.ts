export const EAS_VOTE_SCHEMA =
  "uint256 publicationProfileId,uint256 publicationId,uint256 actorProfileId,address actorProfileOwner,address transactionExecutor,uint8 optionIndex,uint40 timestamp";
export const EAS_VOTE_ABI = [
  { type: "uint256", name: "publicationProfileId" },
  { type: "uint256", name: "publicationId" },
  { type: "uint256", name: "actorProfileId" },
  { type: "address", name: "actorProfileOwner" },
  { type: "address", name: "transactionExecutor" },
  { type: "uint8", name: "optionIndex" },
  { type: "uint40", name: "timestamp" },
];
export const EAS_POLL_ACTION_MODULE_ADDRESS = "0xc91C3d3eD7089a9b52945c8967CF0854f08E9e7a";

export const EAS_ADDRESS = "0x5E634ef5355f45A855d02D66eCD687b1502AF790";
export const EAS_VOTE_SCHEMA_UID = "0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd";
export const EAS_GRAPHQL_ENDPOINT = "https://polygon.easscan.org/graphql";

export const EAS_ADDRESS_TESTNET = "0xaEF4103A04090071165F78D45D83A0C0782c2B2a";
export const EAS_VOTE_SCHEMA_UID_TESTNET = "0x44c235a2465c4d70bd980bdcf968d1997b237e2c7d30a2de1b59b98fee4a1f37";
export const EAS_GRAPHQL_ENDPOINT_TESTNET = "https://polygon-mumbai.easscan.org/graphql";

export const GET_VOTE_COUNT_QUERY = `
  query GetVoteCount($schemaId: String!, $pollId: String!) {
    groupByAttestation(
      where: { schemaId: { equals: $schemaId }, data: { startsWith: $pollId }, revoked: { equals: false } }
      by: [schemaId]
      orderBy: [{ _count: { schemaId: asc } }]
    ) {
      _count {
        _all
      }
    }
  }
`;

export const GET_VOTE_COUNT_FOR_OPTION_QUERY = `
  query GetVoteCountForOptionIndex($schemaId: String!, $pollId: String!, $optionIndex: String!) {
    groupByAttestation(
      where: {
        schemaId: { equals: $schemaId }
        decodedDataJson: { contains: $optionIndex }
        data: { startsWith: $pollId }
        revoked: { equals: false }
      }
      by: [schemaId]
    ) {
      _count {
        _all
      }
    }
  }
`;

export const GET_VOTE_FOR_ACTOR_QUERY = `
  query GetVote($schemaId: String!, $data: String!) {
    attestations(
      where: {schemaId: {equals: $schemaId}, data: {startsWith: $data}}
    ) {
      attester
      id
      revoked
      data
    }
  }
`;
