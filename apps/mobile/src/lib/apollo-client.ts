// Mock Apollo Client - replace with actual AppSync implementation when backend is deployed
// For now, this provides the same interface without requiring AWS packages

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

const graphqlEndpoint =
  'http://localhost:4566/graphql';

// HTTP link
const httpLink = createHttpLink({
  uri: graphqlEndpoint,
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Retry link for offline support
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true,
  },
  attempts: {
    max: 5,
    retryIf: (error) => {
      return !!error && error.statusCode !== 401;
    },
  },
});

// Simple link without auth for now
const link = ApolloLink.from([
  retryLink,
  errorLink,
  httpLink,
]);

// Cache configuration with offline support
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        workouts: {
          merge(_, incoming) {
            return incoming;
          },
        },
        meals: {
          merge(_, incoming) {
            return incoming;
          },
        },
        sleepSessions: {
          merge(_, incoming) {
            return incoming;
          },
        },
      },
    },
  },
});

// Create Apollo Client
export const client = new ApolloClient({
  link,
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

export default client;
