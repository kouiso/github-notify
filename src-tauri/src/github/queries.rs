/// GraphQL query for searching issues and PRs
pub const SEARCH_QUERY: &str = r#"
query SearchIssuesAndPRs($query: String!, $first: Int!) {
  viewer {
    login
  }
  search(query: $query, type: ISSUE, first: $first) {
    issueCount
    nodes {
      __typename
      ... on Issue {
        id
        number
        title
        url
        state
        createdAt
        updatedAt
        author {
          login
          avatarUrl
        }
        repository {
          name
          owner {
            login
          }
        }
        labels(first: 10) {
          nodes {
            name
            color
          }
        }
      }
      ... on PullRequest {
        id
        number
        title
        url
        state
        isDraft
        reviewDecision
        createdAt
        updatedAt
        author {
          login
          avatarUrl
        }
        repository {
          name
          owner {
            login
          }
        }
        labels(first: 10) {
          nodes {
            name
            color
          }
        }
      }
    }
  }
}
"#;

/// GraphQL query for verifying token and getting user info
pub const VIEWER_QUERY: &str = r#"
query GetViewer {
  viewer {
    login
    avatarUrl
  }
}
"#;
