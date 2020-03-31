import { ApolloServer, gql } from "apollo-server-micro";
import { getSamples } from "./_common";

const typeDefs = gql`
  type Sample {
    active: Int
    suspects: Int
    recovered: Int
    deaths: Int
    timestamp: String
    country: String
  }

  type Query {
    samples: [Sample]!
  }
`;

const resolvers = {
  Query: {
    samples: async () => {
      const samples = await getSamples();

      return samples.map(sample => ({
        ...sample,
        timestamp: sample.timestamp.toISOString()
      }));
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers, introspection: true });

export = server.createHandler({ path: "/api/graphql" });
