export const EAS_POLL_SCHEMA =
  "uint256 publicationProfileId,uint256 publicationId,uint256 actorProfileId,address actorProfileOwner,address transactionExecutor,uint8 optionIndex,uint40 timestamp";
export const EAS_POLL_ACTION_MODULE_ADDRESS = "0xBd43F2Bc51020347619c2cC243E3B21859f4f64c";

export const EAS_ADDRESS = "0x5E634ef5355f45A855d02D66eCD687b1502AF790";
export const EAS_POLL_SCHEMA_UID = "0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd";
export const EAS_GRAPHQL_ENDPOINT = "https://polygon.easscan.org/graphql";

export const EAS_ADDRESS_TESTNET = "0xaEF4103A04090071165F78D45D83A0C0782c2B2a";
export const EAS_POLL_SCHEMA_UID_TESTNET = "0x5e67b8b854d74789f6fa56f202907f85e3e53b87abe3d218c9f6dee1cc60ecbd";
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
