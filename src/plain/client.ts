/**
 * The one function that talks to Plain's GraphQL API.
 *
 * Calls go straight from the browser to Plain with the signed-in user's access
 * token, the same way you would send an API key. Plain runs each call as that
 * user, with their role's permissions.
 */

const API_URL = import.meta.env.VITE_PLAIN_API_URL?.trim() || "https://core-api.uk.plain.com/graphql/v1";

/** A call to Plain's API failed. `code` is the GraphQL error extension code, e.g. `FORBIDDEN`, when there is one. */
export class PlainApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "PlainApiError";
    this.code = code;
  }
}

/** The access token was rejected: it expired, or the OAuth app was turned off or deleted. */
export class PlainAuthError extends PlainApiError {
  constructor(message = "Your Plain session is no longer valid.") {
    super(message, "UNAUTHENTICATED");
    this.name = "PlainAuthError";
  }
}

type GraphQLResponse<TData> = {
  data?: TData | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

export async function plainRequest<TData>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables, operationName: operationNameOf(query) }),
  });

  if (response.status === 401) {
    throw new PlainAuthError();
  }
  if (response.status === 429) {
    throw new PlainApiError("Plain is rate limiting requests. Wait a moment and try again.", "RATE_LIMITED");
  }

  const body = (await response.json().catch(() => null)) as GraphQLResponse<TData> | null;

  // Query errors (unauthenticated, forbidden, invalid input...) come back in
  // `errors`. Mutation errors are part of `data` instead; see operations.ts.
  const firstError = body?.errors?.[0];
  if (firstError) {
    const code = firstError.extensions?.code;
    if (code === "UNAUTHENTICATED") {
      throw new PlainAuthError(firstError.message);
    }
    throw new PlainApiError(firstError.message, code);
  }

  if (!response.ok || !body?.data) {
    throw new PlainApiError(`Plain's API responded with HTTP ${response.status}.`);
  }

  return body.data;
}

// The name after `query` or `mutation`. Optional for single-operation
// documents, but it labels each request in the browser's network tab.
function operationNameOf(query: string): string | undefined {
  return /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
}
