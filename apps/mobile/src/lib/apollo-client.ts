// Apollo Client configuration for AWS AppSync
// Supports both local development and production AWS deployments

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  from,
  Operation,
  NextLink,
  Observable,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { fetchAuthSession } from 'aws-amplify/auth';

// GraphQL endpoint - from environment or default to LocalStack for local dev
const graphqlEndpoint =
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4566/graphql';

// HTTP link
const httpLink = createHttpLink({
  uri: graphqlEndpoint,
});

// Auth link for AppSync
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
    // Demo mode - use API key if available, otherwise no auth
    return process.env.EXPO_PUBLIC_API_KEY
      ? { 'x-api-key': process.env.EXPO_PUBLIC_API_KEY }
      : {};
  }

  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();

    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch (error) {
    console.warn('Failed to get auth session:', error);
  }

  return {};
};

// Custom auth link
const authLink = new ApolloLink((operation: Operation, forward: NextLink) => {
  return new Observable((observer) => {
    getAuthHeaders().then((headers) => {
      operation.setContext({
        headers: {
          ...operation.getContext().headers,
          ...headers,
        },
      });
      const forward$ = forward(operation);
      return forward$.subscribe(observer);
    }).catch((error) => {
      observer.error(error);
    });
  });
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
      if (!error) return false;
      // Don't retry on authentication errors
      return error.statusCode !== 401;
    },
  },
});

// Create the link chain
const link = from([
  retryLink,
  errorLink,
  authLink,
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
