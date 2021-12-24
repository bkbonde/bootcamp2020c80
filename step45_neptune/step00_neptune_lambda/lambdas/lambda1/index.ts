//https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-gremlin-node-js.html
//https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html

import { driver, process as gprocess } from 'gremlin';
import * as async from 'async';

// Type for environment variables
declare var process: {
  env: {
    NEPTUNE_ENDPOINT: string;
  };
};

// Define connection and gremlin process
let conn: driver.DriverRemoteConnection;
let g: gprocess.GraphTraversalSource;

// Query function to define query
async function query() {
  return g.V().limit(1).count().next();
}

// Query function to run the query and get results
async function doQuery() {
  let result = await query();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: result['value'],
  };
}

// Lambda handler
export async function handler() {
  // function to get connection details
  const getConnectionDetails = () => {
    const database_url =
      'wss://' + process.env.NEPTUNE_ENDPOINT + ':8182/gremlin';
    return { url: database_url, headers: {} };
  };

  // Create remote connection with naptune cluster
  const createRemoteConnection = () => {
    const { url, headers } = getConnectionDetails();
    return new driver.DriverRemoteConnection(url, {
      mimeType: 'application/vnd.gremlin-v2.0+json',
      pingEnabled: false,
      headers: headers,
    });
  };

  // Get germlin processes
  const createGraphTraversalSource = (conn: driver.DriverRemoteConnection) => {
    return gprocess.traversal().withRemote(conn);
  };

  // If connection not established already chk again and try
  if (conn == null) {
    conn = createRemoteConnection();
    g = createGraphTraversalSource(conn);
  }

  // Run the query if it fails retry establishing connection for 5 times for each specified error
  return async.retry(
    {
      times: 5,
      interval: 1000,
      errorFilter: function (err) {
        // Add filters here to determine whether error can be retried
        console.warn('Determining whether retriable error: ' + err.message);

        // Check for connection issues
        if (err.message.startsWith('WebSocket is not open')) {
          console.warn('Reopening connection');
          conn.close();
          conn = createRemoteConnection();
          g = createGraphTraversalSource(conn);
          return true;
        }

        // Check for ConcurrentModificationException
        if (err.message.includes('ConcurrentModificationException')) {
          console.warn(
            'Retrying query because of ConcurrentModificationException'
          );
          return true;
        }

        // Check for ReadOnlyViolationException
        if (err.message.includes('ReadOnlyViolationException')) {
          console.warn('Retrying query because of ReadOnlyViolationException');
          return true;
        }

        return false;
      },
    },
    doQuery
  );
}
